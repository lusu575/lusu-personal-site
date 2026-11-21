// WebGL2 utility helpers for the Pond CRT rendering pipeline

export function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader error';
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed:\n${info}\n---\n${source}`);
  }
  return shader;
}

export function createProgram(gl, vertSrc, fragSrc) {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown link error';
    gl.deleteProgram(program);
    throw new Error(`Program link failed:\n${info}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const active = gl.getActiveUniform(program, i);
    if (!active) continue;
    const name = active.name.replace(/\[0\]$/, '');
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

export function createFBO(gl, width, height, options = {}) {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const filter = options.filter ?? gl.LINEAR;
  const wrap = options.wrap ?? gl.CLAMP_TO_EDGE;
  const internalFormat = options.internalFormat ?? gl.RGBA8;
  const format = options.format ?? gl.RGBA;
  const type = options.type ?? gl.UNSIGNED_BYTE;

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
  }

  return {
    fbo,
    texture,
    width: w,
    height: h,
    destroy() {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
    }
  };
}

export function createFullscreenVAO(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  // Fullscreen triangle drawn via gl_VertexID in vertex shader
  gl.bindVertexArray(null);
  return vao;
}
