// Smooth input: robust key tracking + buffered presses (no “stuck keys”)
// Also prevents input in text fields from starting the game.

export function createInput(){
  return {
    keys: new Map(),
    pressed: new Map(),
    released: new Map(),
    mouseX:0, mouseY:0,
    pointerDown:false
  };
}

export function bindInput(input, canvas){
  const setKey = (code, down) => {
    const was = input.keys.get(code) || false;
    if (down && !was) input.pressed.set(code, true);
    if (!down && was) input.released.set(code, true);
    input.keys.set(code, down);
  };

  window.addEventListener("keydown", (e)=>{
    // ignore typing in inputs/selects
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "select" || tag === "textarea") return;
    setKey(e.code, true);
  }, { passive:true });

  window.addEventListener("keyup", (e)=> setKey(e.code, false), { passive:true });

  canvas.addEventListener("mousemove", (e)=>{
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
  });

  canvas.addEventListener("pointerdown", ()=> input.pointerDown = true);
  canvas.addEventListener("pointerup", ()=> input.pointerDown = false);
}

export function key(input, code){
  return !!input.keys.get(code);
}
export function wasPressed(input, code){
  return !!input.pressed.get(code);
}
export function wasReleased(input, code){
  return !!input.released.get(code);
}
export function clearFrame(input){
  input.pressed.clear();
  input.released.clear();
}

