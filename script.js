// script.js
// Configuration
const resolutionData = {
  '480': { requiredBandwidth: 2.5, quality: 'Low' },
  '720': { requiredBandwidth: 5, quality: 'Medium' },
  '1080': { requiredBandwidth: 8, quality: 'High' }
};

// Simulation state
let state = {
  playing: false,
  currentResolution: '480',
  isAuto: false,
  availableBandwidth: 5,
  bufferHealth: 100,
  bufferEvents: 0,
  resolutionSwitches: 0,
  networkQuality: 7,
  predictionAggressiveness: 5,
  bandwidthHistory: Array(50).fill(5),
  predictionHistory: Array(50).fill(5),
  timeoutId: null,
  bandwidthNoiseLevel: 0.5,
  pendingBufferEvent: false
};

// DOM Elements
const playBtn = document.getElementById('play');
const pauseBtn = document.getElementById('pause');
const bufferBtn = document.getElementById('buffer');
const resolutionBtns = document.querySelectorAll('.resolution-btn');
const networkConditionsSlider = document.getElementById('network-conditions');
const predictionAggressivenessSlider = document.getElementById('prediction-aggressiveness');
const videoPlayer = document.querySelector('.video-player');
const loadingOverlay = document.querySelector('.loading');
const bufferBar = document.querySelector('.buffer-bar');
const resolutionIndicator = document.querySelector('.resolution-indicator');
const graphContainer = document.getElementById('graph');

// Stats elements
const currentResolutionStat = document.getElementById('current-resolution');
const availableBandwidthStat = document.getElementById('available-bandwidth');
const requiredBandwidthStat = document.getElementById('required-bandwidth');
const bufferHealthStat = document.getElementById('buffer-health');
const bufferEventsStat = document.getElementById('buffer-events');
const resolutionSwitchesStat = document.getElementById('resolution-switches');

// YouTube player variable
let player;

// Initialize
initializeGraph();
updateStats();

// Event Listeners
playBtn.addEventListener('click', startPlayback);
pauseBtn.addEventListener('click', pausePlayback);
bufferBtn.addEventListener('click', triggerBufferEvent);

resolutionBtns.forEach(btn => {
  btn.addEventListener('click', () => {
      const newResolution = btn.dataset.resolution;
      
      // Update active button
      resolutionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update state
      if (newResolution === 'auto') {
          state.isAuto = true;
      } else {
          state.isAuto = false;
          changeResolution(newResolution);
      }
  });
});

networkConditionsSlider.addEventListener('input', () => {
  state.networkQuality = parseInt(networkConditionsSlider.value);
});

predictionAggressivenessSlider.addEventListener('input', () => {
  state.predictionAggressiveness = parseInt(predictionAggressivenessSlider.value);
});

// Functions
function startPlayback() {
  if (!state.playing) {
      state.playing = true;
      updateBufferBar();
      simulateNetworkConditions();
      
      // Start YouTube video if available
      if (player && player.playVideo) {
          player.playVideo();
      }
  }
}

function pausePlayback() {
  state.playing = false;
  if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
  }
  
  // Pause YouTube video if available
  if (player && player.pauseVideo) {
      player.pauseVideo();
  }
}

function triggerBufferEvent() {
  if (state.playing) {
      state.pendingBufferEvent = true;
  }
}

function changeResolution(resolution) {
  if (state.currentResolution !== resolution) {
      state.resolutionSwitches++;
      state.currentResolution = resolution;
      resolutionIndicator.textContent = resolution + 'p';
      updateStats();
      
      // Update YouTube quality if player is ready
      if (player && player.setPlaybackQuality) {
          let youtubeQuality;
          switch(resolution) {
              case '1080':
                  youtubeQuality = 'hd1080';
                  break;
              case '720':
                  youtubeQuality = 'hd720';
                  break;
              case '480':
                  youtubeQuality = 'large';
                  break;
              default:
                  youtubeQuality = 'default';
          }
          player.setPlaybackQuality(youtubeQuality);
      }
  }
}

function simulateNetworkConditions() {
  if (!state.playing) return;
  
  // Base bandwidth from network quality slider (1-10) maps to 1-15 Mbps
  const baseBandwidth = state.networkQuality * 1.5;
  
  // Add some noise to make it realistic
  let noise = (Math.random() - 0.5) * state.bandwidthNoiseLevel * baseBandwidth;
  
  // Handle manual buffer event
  if (state.pendingBufferEvent) {
      noise = -baseBandwidth * 0.8; // Dramatic bandwidth drop
      state.pendingBufferEvent = false;
  }
  
  // Calculate new bandwidth
  let newBandwidth = baseBandwidth + noise;
  newBandwidth = Math.max(0.5, newBandwidth); // Minimum 0.5 Mbps
  state.availableBandwidth = newBandwidth;
  
  // Update bandwidth history
  state.bandwidthHistory.push(newBandwidth);
  state.bandwidthHistory.shift();
  
  // Run prediction algorithm
  const predictedBandwidth = predictBandwidth();
  state.predictionHistory.push(predictedBandwidth);
  state.predictionHistory.shift();
  
  // Calculate buffer health based on bandwidth vs. required
  const requiredBandwidth = resolutionData[state.currentResolution].requiredBandwidth;
  const bandwidthRatio = newBandwidth / requiredBandwidth;
  
  if (bandwidthRatio < 1) {
      // Decrease buffer health when bandwidth is insufficient
      state.bufferHealth -= (1 - bandwidthRatio) * 15;
  } else {
      // Increase buffer health when excess bandwidth is available
      state.bufferHealth += (bandwidthRatio - 1) * 5;
  }
  
  // Clamp buffer health between 0 and 100
  state.bufferHealth = Math.max(0, Math.min(100, state.bufferHealth));
  
  // Check for buffer event
  if (state.bufferHealth <= 0) {
      handleBufferEvent();
  }
  
  // Auto-resolution adaptation if enabled
  if (state.isAuto) {
      adaptResolution(predictedBandwidth);
  }
  
  // Update UI
  updateBufferBar();
  updateGraph();
  updateStats();
  
  // Continue the simulation
  state.timeoutId = setTimeout(simulateNetworkConditions, 300);
}

function handleBufferEvent() {
  state.bufferEvents++;
  state.bufferHealth = 0;
  loadingOverlay.classList.add('active');
  
  // If in auto mode, try to switch to lower resolution
  if (state.isAuto) {
      if (state.currentResolution === '1080') {
          changeResolution('720');
      } else if (state.currentResolution === '720') {
          changeResolution('480');
      }
  }
  
  // Pause YouTube video if available
  if (player && player.pauseVideo) {
      player.pauseVideo();
  }
  
  // Recover after a delay
  setTimeout(() => {
      state.bufferHealth = 30; // Give some initial buffer
      loadingOverlay.classList.remove('active');
      
      // Resume YouTube video if still playing
      if (state.playing && player && player.playVideo) {
          player.playVideo();
      }
  }, 2000);
}

function predictBandwidth() {
  // Get recent bandwidth history
  const recentHistory = state.bandwidthHistory.slice(-10);
  
  // Calculate basic trend: are we going up or down?
  const firstHalf = recentHistory.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const secondHalf = recentHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const trend = secondHalf - firstHalf;
  
  // Calculate standard deviation to measure stability
  const mean = recentHistory.reduce((a, b) => a + b, 0) / recentHistory.length;
  const stdDev = Math.sqrt(
      recentHistory.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / recentHistory.length
  );
  
  // Prediction based on trend, stability, and aggressiveness
  const stabilityFactor = Math.max(0.5, 1 - (stdDev / mean));
  const trendFactor = trend * (state.predictionAggressiveness / 5);
  
  // Current bandwidth with adjustment for trend and stability
  const currentBandwidth = recentHistory[recentHistory.length - 1];
  let prediction = currentBandwidth + trendFactor;
  
  // More aggressive predictions reduce bandwidth estimate for safety
  const aggressivenessFactor = state.predictionAggressiveness / 10;
  prediction = prediction * (1 - (1 - stabilityFactor) * aggressivenessFactor);
  
  return Math.max(0.5, prediction);
}

function adaptResolution(predictedBandwidth) {
  // Add some margin to avoid frequent switches
  const safetyMargin = 1.2; // 20% safety margin
  
  if (predictedBandwidth >= resolutionData['1080'].requiredBandwidth * safetyMargin && state.currentResolution !== '1080') {
      changeResolution('1080');
  } else if (predictedBandwidth >= resolutionData['720'].requiredBandwidth * safetyMargin && 
             predictedBandwidth < resolutionData['1080'].requiredBandwidth && 
             state.currentResolution !== '720') {
      changeResolution('720');
  } else if (predictedBandwidth < resolutionData['720'].requiredBandwidth && state.currentResolution !== '480') {
      changeResolution('480');
  }
}

function updateBufferBar() {
  bufferBar.style.width = state.bufferHealth + '%';
  bufferBar.style.backgroundColor = getBufferColor(state.bufferHealth);
}

function getBufferColor(health) {
  if (health < 30) return '#e74c3c'; // Red for low buffer
  if (health < 70) return '#f39c12'; // Orange for medium buffer
  return '#2ecc71'; // Green for healthy buffer
}

function updateStats() {
  currentResolutionStat.textContent = state.currentResolution + 'p' + (state.isAuto ? ' (Auto)' : '');
  availableBandwidthStat.textContent = state.availableBandwidth.toFixed(2) + ' Mbps';
  requiredBandwidthStat.textContent = resolutionData[state.currentResolution].requiredBandwidth.toFixed(2) + ' Mbps';
  bufferHealthStat.textContent = Math.round(state.bufferHealth) + '%';
  bufferEventsStat.textContent = state.bufferEvents;
  resolutionSwitchesStat.textContent = state.resolutionSwitches;
}

function initializeGraph() {
  // Create initial bars
  for (let i = 0; i < 50; i++) {
      const bar = document.createElement('div');
      bar.className = 'graph-line';
      bar.style.left = ((i / 50) * 100) + '%';
      bar.style.height = (state.bandwidthHistory[i] / 15 * 100) + '%';
      graphContainer.appendChild(bar);
      
      // Add prediction line
      const predictionLine = document.createElement('div');
      predictionLine.className = 'graph-prediction';
      predictionLine.style.left = ((i / 50) * 100) + '%';
      predictionLine.style.height = (state.predictionHistory[i] / 15 * 100) + '%';
      graphContainer.appendChild(predictionLine);
  }
  
  // Add threshold lines for each resolution
  addThresholdLine('480');
  addThresholdLine('720');
  addThresholdLine('1080');
}

function addThresholdLine(resolution) {
  const requiredBandwidth = resolutionData[resolution].requiredBandwidth;
  const lineHeight = (requiredBandwidth / 15 * 100);
  
  const thresholdLine = document.createElement('div');
  thresholdLine.className = 'threshold-line';
  thresholdLine.style.bottom = lineHeight + '%';
  thresholdLine.style.backgroundColor = resolution === '480' ? '#27ae60' : 
                                      resolution === '720' ? '#f39c12' : '#e74c3c';
  
  const thresholdLabel = document.createElement('div');
  thresholdLabel.className = 'threshold-label';
  thresholdLabel.style.bottom = (lineHeight + 5) + '%';
  thresholdLabel.textContent = resolution + 'p';
  
  graphContainer.appendChild(thresholdLine);
  graphContainer.appendChild(thresholdLabel);
}

function updateGraph() {
  const bars = graphContainer.querySelectorAll('.graph-line');
  const predictionLines = graphContainer.querySelectorAll('.graph-prediction');
  
  // Highlight the current resolution requirement
  const requiredBandwidth = resolutionData[state.currentResolution].requiredBandwidth;
  const thresholdLines = graphContainer.querySelectorAll('.threshold-line');
  thresholdLines.forEach(line => {
      line.style.backgroundColor = 'rgba(231, 76, 60, 0.2)';
  });
  
  const currentResLine = Array.from(thresholdLines).find(line => {
      const bottom = parseFloat(line.style.bottom);
      const bandwidthPercent = (requiredBandwidth / 15 * 100);
      return Math.abs(bottom - bandwidthPercent) < 1;
  });
  
  if (currentResLine) {
      currentResLine.style.backgroundColor = 'rgba(39, 174, 96, 0.8)';
  }
  
  // Update bandwidth bars
  bars.forEach((bar, index) => {
      const height = (state.bandwidthHistory[index] / 15 * 100);
      bar.style.height = height + '%';
  });
  
  // Update prediction lines
  predictionLines.forEach((line, index) => {
      const height = (state.predictionHistory[index] / 15 * 100);
      line.style.height = height + '%';
  });
}

// YouTube API Callbacks
function onYouTubeIframeAPIReady() {
  player = new YT.Player('youtube-player', {
      events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
      }
  });
}

function onPlayerReady(event) {
  // Player is ready
  console.log("YouTube player ready");
}

function onPlayerStateChange(event) {
  // Update player state based on YouTube events
  if (event.data == YT.PlayerState.PLAYING) {
      if (!state.playing) {
          startPlayback();
      }
  } else if (event.data == YT.PlayerState.PAUSED) {
      if (state.playing) {
          pausePlayback();
      }
  }
}