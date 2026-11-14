'use client';

import { useEffect, useRef } from 'react';

// Domain-warped noise: slow liquid folds in graphite with platinum highlights.
const FRAG = `precision mediump float;
uniform vec2 r; uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<5;k++){v+=a*n(p);p=p*2.02+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r.y;
  vec2 q=vec2(fbm(uv*1.4+t*.035),fbm(uv*1.4+vec2(5.2,1.3)-t*.03));
  vec2 w=vec2(fbm(uv*1.6+3.*q+vec2(1.7,9.2)+t*.05),fbm(uv*1.6+3.*q+vec2(8.3,2.8)-t*.04));
  float f=fbm(uv*1.2+3.5*w);
  float ridge=smoothstep(.55,.95,f)*.55+smoothstep(.75,1.,length(w))*.25;
  vec3 base=vec3(.043,.043,.047), mid=vec3(.13,.135,.15), hi=vec3(.66,.66,.68);
  vec3 c=mix(base,mid,smoothstep(.2,.8,f));
  c=mix(c,hi,ridge*.35);
  float v=smoothstep(1.25,.25,length(gl_FragCoord.xy/r-vec2(.5,.45)));
  gl_FragColor=vec4(c*mix(.55,1.,v),1.);
}`;
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

/**
 * Slow liquid backdrop for the landing hero. Rendered at half resolution, paused off screen and
 * when the tab is hidden, and drawn once (still) under reduced motion. Without WebGL it renders
 * nothing and the page background shows through.
 */
export function LiquidBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!canvas || !gl) return;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r');
    const uT = gl.getUniformLocation(prog, 't');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let visible = true;
    const start = performance.now();
    const size = () => {
      const scale = 0.5; // shortcut: half resolution keeps the shader cheap; the blur hides it.
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const draw = (now: number) => {
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, still ? 12 : (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!still && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const resume = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; if (visible) resume(); });
    io.observe(canvas);
    const onResize = () => { size(); resume(); };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', resume);
    size();
    resume();
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="liquid-bg" />;
}
