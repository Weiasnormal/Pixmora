import * as THREE from 'three';

export function mountSheet(sheet) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paper = new THREE.Group();
  const scene = new THREE.Scene();
  scene.add(paper);
  const camera = new THREE.OrthographicCamera(-1.38, 1.38, 1.95, -1.95, .1, 20);
  camera.position.z = 6;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch { return; }
  function layer(width, height, depth, color, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({color, roughness: .94}));
    mesh.position.set(x,y,z);
    paper.add(mesh);
  }
  for (let i = 4; i >= 0; i--) {
    layer(2.1, 2.97, .009, i ? 0xe6e4df : 0xfffefa, i * .018, -i * .026, -i * .015);
  }
  for (const tile of sheet.children) {
    const fraction = key => parseFloat(tile.style[key]) / 100;
    const w = fraction('width') * 2.1, h = fraction('height') * 2.97;
    layer(w,h,.002,tile.classList.contains('bg-primary') ? 0xffad0d : 0xc9c9c9,
      -1.05 + fraction('left') * 2.1 + w/2, 1.485 - fraction('top') * 2.97 - h/2, .006);
  }
  scene.add(new THREE.AmbientLight(0xffffff,1.9));
  const key = new THREE.DirectionalLight(0xffffff,1.35);
  key.position.set(-3,5,6); scene.add(key);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(4px 10px 8px rgba(35,32,24,.12))';
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  let frame = 0, targetX = -.22, targetY = -.22;
  paper.rotation.set(targetX,targetY,-.095);
  function render() {
    frame = 0;
    paper.rotation.x += (targetX-paper.rotation.x)*.18;
    paper.rotation.y += (targetY-paper.rotation.y)*.18;
    renderer.render(scene,camera);
    if (Math.abs(targetX-paper.rotation.x)+Math.abs(targetY-paper.rotation.y)>.001) frame=requestAnimationFrame(render);
  }
  function refresh() {
    renderer.setSize(sheet.clientWidth,sheet.clientHeight,false);
    if (!frame) render();
  }
  refresh();
  sheet.append(canvas);
  sheet.classList.add('dimensional-sheet');
  const observer = new ResizeObserver(refresh);
  observer.observe(sheet);
  const events = new AbortController();
  function tilt(x,y) { targetX=x; targetY=y; if (!frame) render(); }
  sheet.addEventListener('pointermove',event=>{
    if (reduced.matches || event.pointerType==='touch') return;
    const rect=sheet.getBoundingClientRect();
    tilt(-.22-(event.clientY-rect.top-rect.height/2)/rect.height*.26,-.22+(event.clientX-rect.left-rect.width/2)/rect.width*.35);
  }, {signal: events.signal});
  sheet.addEventListener('pointerleave',()=>tilt(-.22,-.22), {signal: events.signal});
  canvas.addEventListener('webglcontextlost',()=>{ cancelAnimationFrame(frame); sheet.classList.remove('dimensional-sheet'); canvas.hidden=true; });
  return () => {
    events.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    paper.children.forEach(mesh => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    renderer.dispose();
    canvas.remove();
    sheet.classList.remove('dimensional-sheet');
  };
}