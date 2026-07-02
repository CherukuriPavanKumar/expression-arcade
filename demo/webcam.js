/**
 * FaceAPI Demo for Browsers
 * Loaded via `webcam.html`
 */

import * as faceapi from '../dist/face-api.esm.js'; // use when in dev mode
// import * as faceapi from '@vladmandic/face-api'; // use when downloading face-api as npm

// configuration options
const modelPath = '../model/'; // path to model folder that will be loaded using http
// const modelPath = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'; // path to model folder that will be loaded using http
const minScore = 0.2; // minimum score
const maxResults = 5; // maximum number of results to return
let optionsSSDMobileNet;

// game state
const emojiMap = {
  '😐': 'neutral',
  '😀': 'happy',
  '😲': 'surprised',
  '😢': 'sad'
};
let gameState = 'start'; // start, playing, gameover
let score = 0;
let timeLeft = 30;
let targetEmoji = '';
let targetExpression = '';
let gameInterval;
let lastMatchTime = 0;
let holdStartTime = 0;
let comboStreak = 0;

function pickNewEmoji() {
  const emojis = Object.keys(emojiMap);
  let newEmoji;
  do {
    newEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  } while (newEmoji === targetEmoji && emojis.length > 1);
  targetEmoji = newEmoji;
  targetExpression = emojiMap[targetEmoji];
  const el = document.getElementById('target-emoji');
  if (el) el.innerText = targetEmoji;
  const label = document.getElementById('expression-label');
  if (label) label.innerText = targetExpression.toUpperCase();
}

function startGame() {
  score = 0;
  timeLeft = 30;
  comboStreak = 0;
  holdStartTime = 0;
  
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const hud = document.getElementById('hud');
  const countdownEl = document.getElementById('countdown-overlay');
  
  if (startScreen) startScreen.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'none';
  
  // Show 3-2-1 countdown
  if (countdownEl) {
    countdownEl.style.display = 'flex';
    let count = 3;
    countdownEl.innerText = count;
    const countInterval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownEl.innerText = count;
      } else {
        clearInterval(countInterval);
        countdownEl.style.display = 'none';
        actuallyStartGame();
      }
    }, 800);
  } else {
    actuallyStartGame();
  }
}

function actuallyStartGame() {
  gameState = 'playing';
  
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = 'flex';
  
  const scoreEl = document.getElementById('score');
  if (scoreEl) scoreEl.innerText = score;
  const timeEl = document.getElementById('time-left');
  if (timeEl) timeEl.innerText = timeLeft;
  
  pickNewEmoji();
  
  gameInterval = setInterval(() => {
    timeLeft--;
    const tEl = document.getElementById('time-left');
    if (tEl) tEl.innerText = timeLeft;
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  gameState = 'gameover';
  clearInterval(gameInterval);
  
  const hud = document.getElementById('hud');
  const gameOverScreen = document.getElementById('game-over-screen');
  
  if (hud) hud.style.display = 'none';
  if (gameOverScreen) gameOverScreen.style.display = 'block';
  
  const finalScoreEl = document.getElementById('final-score');
  if (finalScoreEl) finalScoreEl.innerText = score;
}

// helper function to pretty-print json object to string
function str(json) {
  let text = '<font color="lightblue">';
  text += json ? JSON.stringify(json).replace(/{|}|"|\[|\]/g, '').replace(/,/g, ', ') : '';
  text += '</font>';
  return text;
}

// helper function to print strings to html document as a log
function log(...txt) {
  console.log(...txt); // eslint-disable-line no-console
  const div = document.getElementById('log');
  if (div) div.innerHTML += `<br>${txt}`;
}

// helper function to draw detected faces
function drawFaces(canvas, data, fps) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // draw title
  ctx.font = 'small-caps 20px "Segoe UI"';
  ctx.fillStyle = 'white';
  ctx.fillText(`FPS: ${fps}`, 10, 25);
  for (const person of data) {
    // draw box around each face
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'deepskyblue';
    ctx.fillStyle = 'deepskyblue';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.rect(person.detection.box.x, person.detection.box.y, person.detection.box.width, person.detection.box.height);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // draw text labels
    const expression = Object.entries(person.expressions).sort((a, b) => b[1] - a[1]);
    ctx.fillStyle = 'black';
    ctx.fillText(`expression: ${Math.round(100 * expression[0][1])}% ${expression[0][0]}`, person.detection.box.x, person.detection.box.y - 5);
    ctx.fillStyle = 'lightblue';
    ctx.fillText(`expression: ${Math.round(100 * expression[0][1])}% ${expression[0][0]}`, person.detection.box.x, person.detection.box.y - 6);
    // draw face points for each face
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = 'lightblue';
    const pointSize = 2;
    for (let i = 0; i < person.landmarks.positions.length; i++) {
      ctx.beginPath();
      ctx.arc(person.landmarks.positions[i].x, person.landmarks.positions[i].y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

async function detectVideo(video, canvas) {
  if (!video || video.paused) return false;
  const t0 = performance.now();
  faceapi
    .detectAllFaces(video, optionsSSDMobileNet)
    .withFaceLandmarks()
    .withFaceExpressions()
    .then((result) => {
      const fps = 1000 / (performance.now() - t0);
      drawFaces(canvas, result, fps.toLocaleString());
      
      // Game logic
      if (gameState === 'playing' && result && result.length > 0) {
        const person = result[0];
        const expression = Object.entries(person.expressions).sort((a, b) => b[1] - a[1]);
        const currentExpression = expression[0][0];
        const probability = expression[0][1];
        
        const now = performance.now();
        const progressRing = document.getElementById('progress-ring');
        
        // Show live detected expression
        const detectedEl = document.getElementById('detected-expression');
        if (detectedEl) detectedEl.innerText = `${currentExpression} (${Math.round(probability * 100)}%)`;
        
        if (currentExpression === targetExpression && probability > 0.6) {
          if (holdStartTime === 0) {
            holdStartTime = now;
          }
          
          const holdDuration = now - holdStartTime;
          const requiredHold = 500; // 0.5s hold required
          
          // update progress ring
          if (progressRing) {
            progressRing.style.opacity = '1';
            const progress = Math.min(holdDuration / requiredHold, 1);
            progressRing.style.transform = `translate(-50%, -50%) scale(${0.8 + (progress * 0.2)})`;
          }
          
          if (holdDuration >= requiredHold) {
            // Match successful
            holdStartTime = 0; // reset hold
            if (progressRing) progressRing.style.opacity = '0';
            
            // Combo logic: if within 3s of last match
            if (lastMatchTime > 0 && now - lastMatchTime < 3000) {
              comboStreak++;
            } else {
              comboStreak = 0;
            }
            
            const pointsAwarded = 1 + comboStreak;
            score += pointsAwarded;
            
            const scoreEl = document.getElementById('score');
            if (scoreEl) scoreEl.innerText = score;
            lastMatchTime = now;
            
            pickNewEmoji();
            
            // Visual feedback on success
            const targetEmojiEl = document.getElementById('target-emoji');
            if (targetEmojiEl) {
              targetEmojiEl.style.animation = 'none';
              void targetEmojiEl.offsetWidth; // trigger reflow
              targetEmojiEl.style.animation = 'pulseMatch 0.4s ease-out';
            }
            
            const flash = document.getElementById('flash-overlay');
            if (flash) {
              flash.style.opacity = '1';
              flash.style.transition = 'opacity 0.3s ease-out';
              setTimeout(() => { flash.style.opacity = '0'; }, 300);
            }
            
            if (comboStreak > 0) {
              const comboText = document.getElementById('combo-text');
              if (comboText) {
                comboText.innerText = `${comboStreak + 1}x COMBO!`;
                comboText.style.opacity = '1';
                comboText.style.transform = 'translateY(-20px)';
                setTimeout(() => { 
                  comboText.style.opacity = '0'; 
                  comboText.style.transform = 'translateY(0)';
                }, 1000);
              }
            }
          }
        } else {
          // Reset hold if wrong expression
          holdStartTime = 0;
          if (progressRing) {
            progressRing.style.opacity = '0';
            progressRing.style.transform = 'translate(-50%, -50%) scale(0.8)';
          }
        }
      }

      requestAnimationFrame(() => detectVideo(video, canvas));
      return true;
    })
    .catch((err) => {
      log(`Detect Error: ${str(err)}`);
      return false;
    });
  return false;
}

// just initialize everything and call main function
async function setupCamera() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  if (!video || !canvas) return null;

  log('Setting up camera');
  // setup webcam. note that navigator.mediaDevices requires that page is accessed via https
  if (!navigator.mediaDevices) {
    log('Camera Error: access not supported');
    return null;
  }
  let stream;
  const constraints = { audio: false, video: { facingMode: 'user', resizeMode: 'crop-and-scale' } };
  if (window.innerWidth > window.innerHeight) constraints.video.width = { ideal: window.innerWidth };
  else constraints.video.height = { ideal: window.innerHeight };
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === 'PermissionDeniedError' || err.name === 'NotAllowedError') log(`Camera Error: camera permission denied: ${err.message || err}`);
    if (err.name === 'SourceUnavailableError') log(`Camera Error: camera not available: ${err.message || err}`);
    return null;
  }
  if (stream) {
    video.srcObject = stream;
  } else {
    log('Camera Error: stream empty');
    return null;
  }
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  if (settings.deviceId) delete settings.deviceId;
  if (settings.groupId) delete settings.groupId;
  if (settings.aspectRatio) settings.aspectRatio = Math.trunc(100 * settings.aspectRatio) / 100;
  log(`Camera active: ${track.label}`);
  log(`Camera settings: ${str(settings)}`);
  canvas.addEventListener('click', () => {
    if (video && video.readyState >= 2) {
      if (video.paused) {
        video.play();
        detectVideo(video, canvas);
      } else {
        video.pause();
      }
    }
    log(`Camera state: ${video.paused ? 'paused' : 'playing'}`);
  });
  return new Promise((resolve) => {
    video.onloadeddata = async () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.play();
      detectVideo(video, canvas);
      resolve(true);
    };
  });
}

async function setupFaceAPI() {
  // load face-api models
  await faceapi.nets.ssdMobilenetv1.load(modelPath);
  await faceapi.nets.faceLandmark68Net.load(modelPath);
  await faceapi.nets.faceExpressionNet.load(modelPath);
  optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({ minConfidence: minScore, maxResults });
  // check tf engine state
  log(`Models loaded: ${str(faceapi.tf.engine().state.numTensors)} tensors`);
}

async function main() {
  // initialize tfjs
  log('FaceAPI WebCam Test');

  // if you want to use wasm backend location for wasm binaries must be specified
  // await faceapi.tf?.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${faceapi.tf.version_core}/dist/`);
  // await faceapi.tf?.setBackend('wasm');
  // log(`WASM SIMD: ${await faceapi.tf?.env().getAsync('WASM_HAS_SIMD_SUPPORT')} Threads: ${await faceapi.tf?.env().getAsync('WASM_HAS_MULTITHREAD_SUPPORT') ? 'Multi' : 'Single'}`);

  // default is webgl backend
  await faceapi.tf.setBackend('webgl');
  await faceapi.tf.ready();

  // tfjs optimizations
  if (faceapi.tf?.env().flagRegistry.CANVAS2D_WILL_READ_FREQUENTLY) faceapi.tf.env().set('CANVAS2D_WILL_READ_FREQUENTLY', true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV) faceapi.tf.env().set('WEBGL_EXP_CONV', true);
  if (faceapi.tf?.env().flagRegistry.WEBGL_EXP_CONV) faceapi.tf.env().set('WEBGL_EXP_CONV', true);

  // check version
  log(`Version: FaceAPI ${str(faceapi?.version || '(not loaded)')} TensorFlow/JS ${str(faceapi.tf?.version_core || '(not loaded)')} Backend: ${str(faceapi.tf?.getBackend() || '(not loaded)')}`);

  await setupFaceAPI();
  await setupCamera();
  
  // hook up buttons
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', startGame);
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', startGame);
}

// start processing as soon as page is loaded
window.onload = main;
