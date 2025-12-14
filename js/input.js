export function createInput(){
  return {
    down: new Map(),
    pressed: new Map(),
    mouseX: 0,
    mouseY: 0,
  };
}

export function bindInput(input, canvas){
  window.addEventListener("keydown", (e)=>{
    if(!input.down.get(e.code)) input.pressed.set(e.code, true);
    input.down.set(e.code, true);
  }, { passive:true });

  window.addEventListener("keyup", (e)=>{
    input.down.set(e.code, false);
  }, { passive:true });

  canvas.addEventListener("mousemove", (e)=>{
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
  }, { passive:true });
}

export const key = (input, code)=> !!input.down.get(code);
export const wasPressed = (input, code)=> !!input.pressed.get(code);
export function clearFrame(input){ input.pressed.clear(); }


