/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
(function installLuSuAgentBridge() {
  'use strict';

  var PROTOCOL_VERSION = 1;
  var GAME_ID = 'a-dark-room';
  var MAX_RECEIPTS = 128;
  var revision = 0;
  var fingerprint = '';
  var actionCatalog = null;
  var receipts = [];
  var sessionId = 'game_a-dark-room_' + secureHex(16);

  function ready() {
    return window.Engine && window.$SM && window.State && window.Events
      && window.Button && window.jQuery && Engine.activeModule;
  }

  function install() {
    if (!ready()) {
      window.setTimeout(install, 100);
      return;
    }
    var agent = Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId: sessionId,
      observe: observe,
      actions: actions,
      act: act
    });
    window.gamePage = Object.freeze({ agent: agent });
    fingerprint = capture().fingerprint;
  }

  function observe() {
    var captured = sync();
    return observationEnvelope(captured);
  }

  function actions() {
    var captured = sync();
    var tokenMap = Object.create(null);
    var entries = captured.entries.map(function(entry) {
      var token = 'adr_' + secureHex(16);
      tokenMap[token] = entry;
      return Object.freeze({
        id: entry.id,
        label: entry.label,
        group: entry.group,
        description: entry.description,
        action: Object.freeze({ type: 'invoke', token: token }),
        risk: 'low',
        requiresConfirmation: false
      });
    });
    actionCatalog = { revision: revision, tokenMap: tokenMap };
    return Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId: sessionId,
      revision: revision,
      actions: Object.freeze(entries)
    });
  }

  function act(request) {
    var normalized = normalizeRequest(request);
    var requestFingerprint = normalized.expectedRevision + ':' + normalized.action.token;
    var prior = receipts.find(function(item) { return item.clientActionId === normalized.clientActionId; });
    if (prior) {
      if (prior.fingerprint !== requestFingerprint) {
        throw bridgeError('GAME_CLIENT_ACTION_ID_REUSED', 'The client action id was reused.');
      }
      return Object.freeze(Object.assign({}, prior.result, { deduplicated: true }));
    }

    var before = sync();
    var beforeRevision = revision;
    var catalogEntry = actionCatalog && actionCatalog.revision === beforeRevision
      ? actionCatalog.tokenMap[normalized.action.token]
      : null;
    if (normalized.expectedRevision !== beforeRevision || !catalogEntry) {
      throw bridgeError('GAME_REVISION_CONFLICT', 'The A Dark Room action is stale.');
    }
    var liveEntry = capture().entries.find(function(entry) { return entry.key === catalogEntry.key; });
    if (!liveEntry) {
      actionCatalog = null;
      throw bridgeError('GAME_ACTION_TOKEN_INVALID', 'The A Dark Room action is no longer available.');
    }

    var invoked = liveEntry.invoke();
    var after = capture();
    var status = invoked ? 'applied' : 'noop';
    var reason = invoked ? 'action-invoked' : 'action-unavailable';
    if (invoked) revision = beforeRevision + 1;
    fingerprint = after.fingerprint;
    actionCatalog = null;
    var observation = observationEnvelope(after);
    var result = Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId: sessionId,
      clientActionId: normalized.clientActionId,
      status: status,
      reason: reason,
      beforeRevision: beforeRevision,
      revision: revision,
      deduplicated: false,
      events: Object.freeze(invoked ? [Object.freeze({ type: 'semantic_action', action: liveEntry.id })] : []),
      observation: observation
    });
    receipts.push({ clientActionId: normalized.clientActionId, fingerprint: requestFingerprint, result: result });
    if (receipts.length > MAX_RECEIPTS) receipts.splice(0, receipts.length - MAX_RECEIPTS);
    return result;
  }

  function normalizeRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)
      || Object.keys(request).sort().join(',') !== 'action,clientActionId,expectedRevision') {
      throw bridgeError('GAME_ACTION_REQUEST_INVALID', 'Invalid A Dark Room action request.');
    }
    var expectedRevision = Number(request.expectedRevision);
    var clientActionId = String(request.clientActionId || '');
    var action = request.action;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(clientActionId)
      || !action || typeof action !== 'object' || Array.isArray(action)
      || Object.keys(action).sort().join(',') !== 'token,type'
      || action.type !== 'invoke' || !/^adr_[a-f0-9]{32}$/.test(action.token)) {
      throw bridgeError('GAME_ACTION_REQUEST_INVALID', 'Invalid A Dark Room action identity.');
    }
    return { expectedRevision: expectedRevision, clientActionId: clientActionId, action: action };
  }

  function sync() {
    var captured = capture();
    if (fingerprint && captured.fingerprint !== fingerprint) {
      revision += 1;
      actionCatalog = null;
    }
    fingerprint = captured.fingerprint;
    return captured;
  }

  function capture() {
    var event = currentEvent();
    var location = locationName(Engine.activeModule);
    var entries = event ? eventEntries(event) : locationEntries(Engine.activeModule);
    var state = {
      location: location,
      event: event ? {
        title: boundedText(event.title, 160),
        scene: boundedText(Events.activeScene || '', 80),
        description: boundedText($('#description', event.eventPanel).text(), 1200)
      } : null,
      stores: numericMap(State.stores, 96),
      population: finiteNumber($SM.get('game.population', true), 0),
      workers: numericMap($SM.get('game.workers') || {}, 48),
      outfit: numericMap(window.Path && Path.outfit ? Path.outfit : {}, 64),
      world: worldState(),
      messages: $('#notifications .notification, #gameLog .event, #gameLog .notification')
        .slice(-12).map(function() { return boundedText($(this).text(), 240); }).get()
    };
    var signature = entries.map(function(entry) { return entry.key + ':' + entry.label; });
    return {
      state: state,
      entries: entries,
      fingerprint: JSON.stringify({ state: state, actions: signature })
    };
  }

  function observationEnvelope(captured) {
    var terminal = window.Space && Engine.activeModule === Space && $('#restart').length > 0;
    return Object.freeze({
      protocolVersion: PROTOCOL_VERSION,
      gameId: GAME_ID,
      sessionId: sessionId,
      revision: revision,
      phase: captured.state.event ? 'event' : (captured.state.location || 'loading'),
      terminal: terminal,
      score: Object.freeze({ current: finiteNumber(window.Scoring && Scoring.calculateScore ? Scoring.calculateScore() : 0, 0) }),
      state: deepFreeze(captured.state)
    });
  }

  function currentEvent() {
    if (!Events.eventStack || Events.eventStack.length === 0) return null;
    var event = Events.activeEvent();
    if (!event || !event.eventPanel || !event.eventPanel.length) return null;
    return event;
  }

  function forbiddenEvent(event) {
    var title = boundedText(event && event.title, 160);
    var blocked = [safeTranslate('Export / Import'), safeTranslate('Restart?'), safeTranslate('Get the App')];
    return blocked.indexOf(title) >= 0 || /export|import|restart|dropbox/i.test(title);
  }

  function eventEntries(event) {
    if (forbiddenEvent(event)) return [];
    var root = event.eventPanel && event.eventPanel[0];
    if (!root) return [];
    return buttonEntries($(root).find('.button'), root, 'event');
  }

  function locationEntries(module) {
    var entries = [];
    var root = module && module.panel && module.panel[0];
    if (root) entries = entries.concat(buttonEntries($(root).find('.button'), root, 'location'));
    entries = entries.concat(travelEntries(module));
    if (window.Outside && module === Outside) entries = entries.concat(adjustmentEntries(root, '.workerRow', 'worker'));
    if (window.Path && module === Path) entries = entries.concat(adjustmentEntries(root, '.outfitRow', 'outfit'));
    if (window.World && module === World) entries = entries.concat(worldMoveEntries());
    return uniqueEntries(entries).slice(0, 160);
  }

  function buttonEntries(buttons, root, group) {
    var entries = [];
    buttons.each(function(index) {
      var element = this;
      var button = $(element);
      var handler = button.data('handler');
      if (!buttonAvailable(element, root) || typeof handler !== 'function' || forbiddenButton(button, handler)) return;
      var id = String(button.attr('id') || ('button-' + index));
      var label = boundedText(button.clone().children().remove().end().text() || button.text(), 180);
      if (!label) return;
      var key = 'button:' + locationName(Engine.activeModule) + ':' + id + ':' + label;
      entries.push({
        key: key,
        id: safeActionId('button-' + id + '-' + index),
        label: label,
        group: group,
        description: 'Invoke this audited in-game button.',
        invoke: function() {
          if (!buttonAvailable(element, root) || forbiddenButton(button, button.data('handler'))) return false;
          button.triggerHandler('click');
          return true;
        }
      });
    });
    return entries;
  }

  function forbiddenButton(button, handler) {
    var id = String(button.attr('id') || '').toLowerCase();
    var label = boundedText(button.clone().children().remove().end().text() || button.text(), 180).toLowerCase();
    if (/reset|restart|delete|import|export|dropbox|github|share|appstore/.test(id + ' ' + label)) return true;
    return handler === Engine.deleteSave || handler === Engine.import64 || handler === Engine.exportImport
      || handler === Engine.confirmDelete || handler === Engine.getApp || handler === Engine.share;
  }

  function adjustmentEntries(root, rowSelector, group) {
    if (!root) return [];
    var entries = [];
    $(root).find(rowSelector).each(function(rowIndex) {
      var row = this;
      var rowName = boundedText($(row).find('.row_key').first().text() || $(row).attr('key'), 120);
      if (!rowName) return;
      [
        ['.upBtn', 1, 'increase'],
        ['.dnBtn', 1, 'decrease'],
        ['.upManyBtn', 10, 'increase'],
        ['.dnManyBtn', 10, 'decrease']
      ].forEach(function(spec, controlIndex) {
        var control = $(row).find(spec[0]).first()[0];
        if (!control || !control.isConnected) return;
        var key = group + ':' + rowName + ':' + spec[2] + ':' + spec[1];
        entries.push({
          key: key,
          id: safeActionId(group + '-' + rowIndex + '-' + controlIndex),
          label: spec[2] + ' ' + rowName + ' by ' + spec[1],
          group: group,
          description: 'Adjust this audited in-game allocation control.',
          invoke: function() {
            if (!control.isConnected || !root.contains(control) || !row.contains(control)) return false;
            $(control).triggerHandler('click');
            return true;
          }
        });
      });
    });
    return entries;
  }

  function travelEntries(activeModule) {
    if (currentEvent()) return [];
    var modules = [
      ['room', window.Room], ['outside', window.Outside], ['path', window.Path],
      ['fabricator', window.Fabricator], ['ship', window.Ship]
    ];
    return modules.filter(function(item) {
      var module = item[1];
      return module && module !== activeModule && module.tab && module.tab.length && module.panel && module.panel.length;
    }).map(function(item) {
      var name = item[0];
      var module = item[1];
      return {
        key: 'travel:' + name,
        id: 'travel-' + name,
        label: 'Travel to ' + name,
        group: 'travel',
        description: 'Switch to this unlocked in-game location.',
        invoke: function() {
          if (!module.tab || !module.tab.length || !module.panel || !module.panel.length || currentEvent()) return false;
          Engine.travelTo(module);
          return true;
        }
      };
    });
  }

  function worldMoveEntries() {
    if (currentEvent() || !Array.isArray(World.curPos) || !Number.isFinite(World.RADIUS)) return [];
    var moves = [
      ['north', World.moveNorth, function() { return World.curPos[1] > 0; }],
      ['south', World.moveSouth, function() { return World.curPos[1] < World.RADIUS * 2; }],
      ['west', World.moveWest, function() { return World.curPos[0] > 0; }],
      ['east', World.moveEast, function() { return World.curPos[0] < World.RADIUS * 2; }]
    ];
    return moves.filter(function(move) { return move[2](); }).map(function(move) {
      return {
        key: 'move:' + move[0] + ':' + World.curPos.join(','),
        id: 'move-' + move[0],
        label: 'Move ' + move[0],
        group: 'world',
        description: 'Move one semantic map tile in this direction.',
        invoke: function() {
          if (Engine.activeModule !== World || currentEvent() || !move[2]()) return false;
          move[1]();
          return true;
        }
      };
    });
  }

  function buttonAvailable(element, root) {
    if (!element || !element.isConnected || !root || !root.contains(element)) return false;
    var button = $(element);
    return !button.hasClass('disabled') && button.css('display') !== 'none' && button.css('visibility') !== 'hidden';
  }

  function worldState() {
    if (!window.World || Engine.activeModule !== World) return null;
    return {
      position: Array.isArray(World.curPos) ? World.curPos.slice(0, 2).map(function(value) { return finiteNumber(value, 0); }) : null,
      health: finiteNumber(World.health, 0),
      water: finiteNumber(World.water, 0),
      food: finiteNumber(window.Path && Path.outfit ? Path.outfit['cured meat'] : 0, 0),
      danger: World.danger === true
    };
  }

  function locationName(module) {
    var known = [
      ['room', window.Room], ['outside', window.Outside], ['path', window.Path],
      ['world', window.World], ['fabricator', window.Fabricator], ['ship', window.Ship], ['space', window.Space]
    ];
    var match = known.find(function(item) { return item[1] && module === item[1]; });
    return match ? match[0] : 'unknown';
  }

  function numericMap(value, limit) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    var result = {};
    Object.keys(value).sort().slice(0, limit).forEach(function(key) {
      if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[boundedText(key, 80)] = value[key];
    });
    return result;
  }

  function uniqueEntries(entries) {
    var seen = Object.create(null);
    return entries.filter(function(entry) {
      if (seen[entry.key]) return false;
      seen[entry.key] = true;
      return true;
    });
  }

  function safeActionId(value) {
    var normalized = String(value || 'action').replace(/[^A-Za-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
    return (normalized || 'action').slice(0, 128);
  }

  function safeTranslate(value) {
    try { return boundedText(_(value), 160); } catch (error) { return value; }
  }

  function boundedText(value, limit) {
    var text = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, limit);
  }

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function(key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }

  function secureHex(length) {
    var bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.prototype.map.call(bytes, function(value) { return value.toString(16).padStart(2, '0'); }).join('');
  }

  function bridgeError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  install();
}());
