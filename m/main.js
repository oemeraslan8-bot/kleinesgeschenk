const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* ================= FULLSCREEN ================= */
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

/* ================= TILE & MAP ================= */
const TILE = 72;
/*
0 = Schnee
1 = Wand
2 = Kuchen (Ziel)
3 = Tod
*/
const map = [
[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
[1,0,0,0,0,0,0,3,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,1,0,1],
[1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,3,0,1],
[1,1,1,1,0,1,0,1,1,0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1],
[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
[1,0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,3,1],
[1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,2,1],
[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

/* ================= WORLD TEXT ================= */
const birthdayTexts = [
  { x: 2,  y: 1,  text: "HAPPY" },
  { x: 10, y: 3,  text: "BIRTH" },
  { x: 18, y: 5,  text: "DAY" },
  { x: 26, y: 7,  text: "🎉" },
];

/* ================= PLAYER ================= */
const PLAYER_W = 64;
const PLAYER_H = 96; // höher, nicht quadratisch

const idleImg = new Image();
const walkImg = new Image();
const celebrateImg = new Image();

idleImg.src = "assets/player/idle.png";
walkImg.src = "assets/player/walk.png";
celebrateImg.src = "assets/player/celebrate.png";

const player = {
  tileX: 1,
  tileY: 1,
  x: 0,
  y: 0,
  moving: false,
  progress: 0,
  dirX: 0,
  dirY: 0,
  speed: 4,
  state: "idle"
};

function syncPlayer() {
  player.x = player.tileX * TILE + TILE / 2;
  player.y = player.tileY * TILE + TILE;
}
syncPlayer();

/* ================= CAMERA ================= */
const camera = { x: 0, y: 0 };

/* ================= CAKE (6 FRAMES) ================= */
const cakeFrames = [];
for (let i = 1; i <= 6; i++) {
  const img = new Image();
  img.src = `assets/cake/cake${i}.png`;
  cakeFrames.push(img);
}

let cakeFrame = 0;
let cakeTimer = 0;
let cakeState = 0; // 0 idle, 1 blow, 2 smoke, 3 done

let cakeTileX = 0, cakeTileY = 0;
map.forEach((row, y) =>
  row.forEach((v, x) => {
    if (v === 2) { cakeTileX = x; cakeTileY = y; }
  })
);

/* ================= SOUNDS ================= */
const stepSound = new Audio("assets/sounds/step.wav");
const cheer = new Audio("assets/sounds/cheer.wav");
cheer.loop = true;
const happyBirthday = new Audio("assets/sounds/happybirthday.wav");

/* ================= MICROPHONE ================= */
let micLevel = 0;
navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  const ac = new AudioContext();
  const src = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  src.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  function read() {
    analyser.getByteTimeDomainData(data);
    micLevel = data.reduce((a,b)=>a+Math.abs(b-128),0)/data.length;
    requestAnimationFrame(read);
  }
  read();
});

/* ================= INPUT ================= */
const keys = {};
addEventListener("keydown", e => keys[e.key] = true);
addEventListener("keyup", e => keys[e.key] = false);

/* ================= TOUCH ================= */
const touch = { up:false,down:false,left:false,right:false };
canvas.addEventListener("touchstart", e => {
  const t = e.touches[0];
  const x = t.clientX;
  const y = t.clientY;
  const w = canvas.width;
  const h = canvas.height;

  touch.left  = x < w * 0.33 && y > h * 0.5;
  touch.right = x > w * 0.66 && y > h * 0.5;
  touch.up    = y < h * 0.5 && x > w * 0.33 && x < w * 0.66;
  touch.down  = y > h * 0.75 && x > w * 0.33 && x < w * 0.66;

  e.preventDefault();
}, { passive: false });

/* ================= SNOW ================= */
const snow = Array.from({length:200},()=>({
  x:Math.random()*canvas.width,
  y:Math.random()*canvas.height,
  r:Math.random()*3+1,
  v:Math.random()*40+20
}));

/* ================= LOOP ================= */
let last=0;
function loop(t){
  const dt=(t-last)/1000; last=t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ================= UPDATE ================= */

function update(dt){
  if(!player.moving){
    let dx=0,dy=0;
    if(keys.ArrowUp||touch.up)dy=-1;
    if(keys.ArrowDown||touch.down)dy=1;
    if(keys.ArrowLeft||touch.left)dx=-1;
    if(keys.ArrowRight||touch.right)dx=1;

    if(dx||dy){
      const nx=player.tileX+dx, ny=player.tileY+dy;
      if(map[ny][nx]!==1){
        player.moving=true;
        player.dirX=dx; player.dirY=dy;
        player.progress=0;
        player.state="walk";
        stepSound.currentTime=0;
        stepSound.play();
      }
    }
  }

  if(player.moving){
    player.progress+=dt*player.speed;
    if(player.progress>=1){
      player.tileX+=player.dirX;
      player.tileY+=player.dirY;
      player.moving=false;
    if (cakeState !== 3) {
      player.state="idle";
    }
      syncPlayer();

      if(map[player.tileY][player.tileX]===3){
        player.tileX=1; player.tileY=1; syncPlayer();
      }

      if(map[player.tileY][player.tileX]===2 && cakeState===0){
        happyBirthday.play();
      }
    }else{
      player.x=(player.tileX+player.dirX*player.progress)*TILE+TILE/2;
      player.y=(player.tileY+player.dirY*player.progress)*TILE+TILE;
    }
  }

  if(map[player.tileY][player.tileX]===2){
    cakeTimer+=dt;
    if(cakeState===0 && micLevel>20){
      cakeState=1; cakeFrame=2; cakeTimer=0;
    }
    if(cakeState===1 && cakeTimer>0.4){
      cakeState=2; cakeFrame=3; cakeTimer=0;
    }
    if(cakeState===2 && cakeTimer>0.4){
      cakeState=3; cakeFrame=5;
      cheer.play();
      player.state="celebrate";
    }
  }

  snow.forEach(s=>{
    s.y+=s.v*dt;
    if(s.y>canvas.height){s.y=-10;s.x=Math.random()*canvas.width;}
  });

  camera.x=player.x-canvas.width/2;
  camera.y=player.y-canvas.height/2;
}

/* ================= DRAW ================= */
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(-camera.x,-camera.y);

  for(let y=0;y<map.length;y++){
    for(let x=0;x<map[0].length;x++){
      ctx.fillStyle =
        map[y][x]===1?"#c7d2fe":
        map[y][x]===3?"#ef4444":
        map[y][x]===2?"#4ade80":"#f8fafc";
      ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      ctx.strokeStyle="#cbd5e1";
      ctx.strokeRect(x*TILE,y*TILE,TILE,TILE);
    }
  }
if (cakeState > 0) {
  ctx.drawImage(
    cakeFrames[cakeFrame],
    cakeTileX*TILE-TILE*0.5,
    cakeTileY*TILE-TILE*3,
    TILE*3,
    TILE*3
  );
}
  const sprite =
    player.state==="walk"?walkImg:
    player.state==="celebrate"?celebrateImg:
    idleImg;

  ctx.drawImage(
  sprite,
  player.x - PLAYER_W / 2,
  player.y - PLAYER_H,
  PLAYER_W,
  PLAYER_H
);


  if (cakeState === 3) {
  ctx.fillStyle = "#0f172a"; // dunkles Blau, gut sichtbar auf Schnee
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  birthdayTexts.forEach(t => {
    ctx.fillText(
      t.text,
      t.x * TILE + TILE / 2,
      t.y * TILE + TILE / 2
    );
  });
}


  ctx.restore();

  ctx.fillStyle="#fff";
  snow.forEach(s=>{
    ctx.beginPath();
    ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
    ctx.fill();
  });

  const colors=["#fde047","#fb7185","#60a5fa","#4ade80"];
  for(let i=20;i<canvas.width;i+=50){
    ctx.fillStyle=colors[Math.floor((Date.now()/400+i)%colors.length)];
    ctx.beginPath();ctx.arc(i,20,6,0,Math.PI*2);ctx.fill();
  }

  if(map[player.tileY][player.tileX]===2 && cakeState===0){
    ctx.fillStyle="#fff";
    ctx.font="24px sans-serif";
    ctx.textAlign="center";
    ctx.fillText("🎂 PUSTE INS MIKROFON!", canvas.width/2, 50);
  }
}
document.querySelectorAll("#controls button").forEach(btn => {
  btn.addEventListener("touchstart", e => {
    e.preventDefault();
    keys["Arrow" + btn.dataset.dir[0].toUpperCase() + btn.dataset.dir.slice(1)] = true;
  });

  btn.addEventListener("touchend", e => {
    e.preventDefault();
    keys["Arrow" + btn.dataset.dir[0].toUpperCase() + btn.dataset.dir.slice(1)] = false;
  });
});

function bindButton(id, dir) {
  const btn = document.getElementById(id);
  btn.addEventListener("touchstart", e => {
    touch[dir] = true;
    e.preventDefault();
  });
  btn.addEventListener("touchend", () => touch[dir] = false);
  btn.addEventListener("mousedown", () => touch[dir] = true);
  btn.addEventListener("mouseup", () => touch[dir] = false);
}

bindButton("up","up");
bindButton("down","down");
bindButton("left","left");
bindButton("right","right");
