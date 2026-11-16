'use client';

import { useEffect, useRef } from 'react';

// Drifting topographic contours over near-black, lit from below by the brand ember (#c2452d).
// fwidth keeps every contour line about one pixel wide however steep the field gets.
const FRAG = `#extension GL_OES_standard_derivatives : enable
precision mediump float;
uniform vec2 r; uniform float t;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*r)/r.y;
  float e=fbm(uv*1.5+vec2(t*.018,-t*.012))+.4*fbm(uv*3.1+vec2(-t*.025,t*.02));
  float b=e*16.;
  float f=fract(b), d=min(f,1.-f), w=fwidth(b);
  float line=1.-smoothstep(0.,w*1.3,d);
  float major=step(mod(floor(b+.5),5.),.5);
  float glow=smoothstep(1.15,0.,length(uv*vec2(.8,1.)-vec2(0.,-.62)));
  vec3 ember=vec3(.76,.27,.18), ash=vec3(.22,.21,.21);
  vec3 c=vec3(.03,.028,.03)+ember*glow*glow*.22;
  c+=mix(ash,ember*1.25,glow)*line*mix(.35,.85,major)*(.35+.65*glow);
  float v=smoothstep(1.2,.3,length(uv*vec2(.7,1.)));
  gl_FragColor=vec4(c*mix(.5,1.,v),1.);
}`;
const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

/**
 * Slow topographic-contour backdrop for the landing hero. Rendered at half resolution, paused off screen and
 * when the tab is hidden, and drawn once (still) under reduced motion. Without WebGL it renders
 * nothing and the page background shows through.
 */
export function LiquidBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!canvas || !gl) return;
    gl.getExtension('OES_standard_derivatives'); // without it the shader fails to link and the CSS background shows
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
