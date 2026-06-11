(function() {
  if (typeof _ !== "function" || typeof _.setDynamicTranslator !== "function") {
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var lang = params.get("lang") || "";
  if (!lang) {
    try {
      lang = localStorage.lang || "";
    } catch (error) {
      lang = "";
    }
  }

  var overrides = {
    zh_cn: {
      "a strange thrumming, pounding and crashing. visions of people and places, of a huge machine and twisting curves.": "一阵奇异的嗡鸣、重击与崩响。人群与地点的幻象、庞大机器与扭曲曲线在眼前闪过。",
      "inviting. it would be so easy to give in, completely.": "它在邀请。彻底放任自己，好像会非常容易。",
      "a strange thrumming, pounding and crashing. and then gone.": "一阵奇异的嗡鸣、重击与崩响。随后消失无踪。",
      "give in": "沉进去"
    },
    ja: {
      "a strange thrumming, pounding and crashing. visions of people and places, of a huge machine and twisting curves.": "奇妙な低いうなり、打ちつける音、砕ける音。人々と場所、巨大な機械、ねじれた曲線の幻が浮かぶ。",
      "inviting. it would be so easy to give in, completely.": "誘っている。すべてを明け渡すのは、きっとあまりにも簡単だ。",
      "a strange thrumming, pounding and crashing. and then gone.": "奇妙な低いうなり、打ちつける音、砕ける音。そして消えた。",
      "give in": "身を委ねる"
    }
  };

  var active = overrides[lang] || {};
  _.setDynamicTranslator(function(text) {
    return active[text] || text;
  });
})();
