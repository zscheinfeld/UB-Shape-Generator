// import GUI from '../node_modules/lil-gui';
import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { SVGRenderer } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/renderers/SVGRenderer.js";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/loaders/OBJLoader.js";

var num = 0;

// Add a global variable to track text positioning for single elements
let singleTextPosition = 'flex-start'; // Default to bottom (flex-end)
// Add global variable to track shape shuffle rotation
let shapeShuffleRotation = 0;
// Global variables for view transitions
let isTransitioning = false;
let transitionStartTime = 0;
const transitionDuration = 800;
let startState = {};
let targetState = {};

// Track if orbit controls have been used since last view preset
let orbitControlsUsed = false;

let lastSelectedPreset = null;

// Updated viewPresets with scale specifications
const viewPresets = [
  {
    name: 'Front View',
    rotation: { x: 0, y: 0, z: 0 },
    extrude: 1,
    camera: -500,
    scale: 1 // Small scale for overview
  },
  {
    name: 'Isometric',
    rotation: { x: Math.PI / 6, y: Math.PI / 4, z: 0 },
    extrude: 15,
    camera: -400,
    scale: 60 // Medium scale for detail
  },
  {
    name: 'Side View',
    rotation: { x: 0, y: Math.PI / 2, z: Math.PI / 4 },
    extrude: 25,
    camera: -450,
    scale: 15 // Medium-low scale
  },
  {
    name: 'Extruded',
    rotation: { x: Math.PI / 6, y: -Math.PI / 6, z: 0 },
    extrude: 60,
    camera: -350,
    scale: 50 // Larger scale to show extrusion detail
  },
  {
    name: 'Top View',
    rotation: { x: Math.PI / 2, y: 0, z: 0 },
    extrude: 30,
    camera: -400,
    scale: 20 // Medium scale for top view
  }
];


// Add these variables at the top with other global variables
let shuffleRotation = 0; // Track button rotation
let textOrder = ['bigText', 'mediumText', 'smallText']; // Default order

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
  const shuffled = [...array]; // Create a copy
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Aspect ratio settings
const aspectRatios = {
  '1:1': { width: 1, height: 1, label: 'Square' },
  '16:9': { width: 16, height: 9, label: 'Widescreen' },
  '4:5': { width: 4, height: 5, label: 'Grid Post' },
  '9:16': { width: 9, height: 16, label: 'Portrait' }
};

// Canvas resizing variables
let canvasIsTransitioning = false;
let targetWidth, targetHeight;
let currentWidth, currentHeight;

// Global camera controls variable
let cameraControls;

// Global text controls - MOVED TO GLOBAL SCOPE
// Update the textControls object to include size settings for each text field
const textControls = {
  bigText: 'We make <br> design matter',
  mediumText: '',
  smallText: '',
  showText: false,
  textColor: '#FFFFFF',
  textPosition: 'bottom-left',
  // Individual size settings for each text field
  bigTextSize: 'big',    // 'big', 'medium', or 'small'
  mediumTextSize: 'medium',
  smallTextSize: 'small'
};


// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// Updated transitionToView function to handle scale
function transitionToView(targetPreset) {
  console.log(`Transitioning to ${targetPreset.name}`);
  
  if (!window.data) {
    console.error('Data not loaded yet');
    return;
  }
  
  // Only reset camera if orbit controls have been used since last preset
  if (orbitControlsUsed) {
    console.log('Orbit controls were used - resetting camera position');
    // Reset camera to base position immediately (hard cut)
    camera.position.set(0, 0, -500);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    
    // Reset OrbitControls target to center
    cameraControls.target.set(0, 0, 0);
    cameraControls.update();
    
    orbitControlsUsed = false; // Reset the flag
  }
  
  isTransitioning = true;
  transitionStartTime = Date.now();
  
  // Capture current state - use actual current camera position
  startState = {
    rotation: {
      x: window.data.rotation.x,
      y: window.data.rotation.y,
      z: window.data.rotation.z
    },
    extrude: window.data.scale.z,
    camera: camera.position.z, // Use current camera position, not reset position
    scale: getCurrentScaleSliderValue() // Get current scale slider value
  };
  
  // Set target state
  targetState = {
    rotation: { ...targetPreset.rotation },
    extrude: targetPreset.extrude,
    camera: targetPreset.camera,
    scale: targetPreset.scale || 1 // Use preset scale or default to 1
  };
  
  console.log('Start state:', startState);
  console.log('Target state:', targetState);
}

// Helper function to get current scale slider value
function getCurrentScaleSliderValue() {
  const scaleSlider = document.getElementById('scaleRange');
  return scaleSlider ? parseFloat(scaleSlider.value) : 1;
}

// Helper function to convert camera position to slider value (reuse existing logic)
function cameraToSliderValue(cameraZ) {
  const normalizedCamera = Math.abs(cameraZ);
  const percentage = (500 - normalizedCamera) / (500 - 100);
  return Math.round(1 + percentage * 99);
}

// Helper function to convert slider value to camera position (reuse existing logic)
function sliderToCameraValue(sliderValue) {
  const percentage = (sliderValue - 1) / 99;
  return -(500 - percentage * 400);
}

// ASPECT RATIO FUNCTIONS - MOVED OUTSIDE setupGUI()
function smoothAspectRatioChange(aspectRatio) {
  updateCanvasDimensions(aspectRatio);
  canvasIsTransitioning = true;
  
  // Update aspect info display
  const aspectInfo = document.getElementById('aspectInfo');
  if (aspectInfo) {
    aspectInfo.style.opacity = '0';
    
    setTimeout(() => {
      aspectInfo.textContent = `${aspectRatio} - ${aspectRatios[aspectRatio].label}`;
      aspectInfo.style.opacity = '1';
    }, 150);
  }
}

function smoothSizeChange(canvasSize, aspectRatio) {
  // This function is now just for triggering updates since we auto-size
  updateCanvasDimensions(aspectRatio);
  canvasIsTransitioning = true;
}

function updateCanvasDimensions(aspectRatio) {
  const ratio = aspectRatios[aspectRatio];
  const posterElement = document.querySelector('.poster');
  const posterWidth = posterElement.clientWidth;
  const posterHeight = posterElement.clientHeight;
  
  // Calculate dimensions to fit poster while maintaining aspect ratio
  const canvasAspectRatio = ratio.width / ratio.height;
  const posterAspectRatio = posterWidth / posterHeight;
  
  if (canvasAspectRatio > posterAspectRatio) {
    // Canvas is wider than poster - fit to poster width
    targetWidth = posterWidth;
    targetHeight = posterWidth / canvasAspectRatio;
  } else {
    // Canvas is taller than poster - fit to poster height
    targetHeight = posterHeight;
    targetWidth = posterHeight * canvasAspectRatio;
  }
  
  console.log(`Canvas dimensions: ${targetWidth} x ${targetHeight} for aspect ratio ${aspectRatio}`);
}

// Add this function to handle HTML aspect ratio buttons - MOVED OUTSIDE setupGUI()
function setupAspectRatioButtons() {
  const aspectRatioButtons = document.querySelectorAll('.ratio');
  let currentActiveButton = null;
  
  // Set initial active state (default to 1:1)
  aspectRatioButtons.forEach((button, index) => {
    const buttonText = button.textContent.trim();
    
    // Set first button (1:1) as active by default
    if (index === 0) {
      button.classList.add('active');
      currentActiveButton = button;
    }
    
    // Add click handler
    button.addEventListener('click', function() {
      // Remove active class from previously active button
      if (currentActiveButton) {
        currentActiveButton.classList.remove('active');
      }
      
      // Add active class to clicked button
      this.classList.add('active');
      currentActiveButton = this;
      
      // Get aspect ratio from button text or data attribute
      let aspectRatio;
      switch(buttonText) {
        case '1:1':
          aspectRatio = '1:1';
          break;
        case '16:9':
          aspectRatio = '16:9';
          break;
        case '4:5':
          aspectRatio = '4:5';
          break;
        case '9:16':
          aspectRatio = '9:16';
          break;
        default:
          aspectRatio = '1:1';
      }
      
      console.log(`Aspect ratio changed to: ${aspectRatio}`);
      
      // Trigger the aspect ratio change
      smoothAspectRatioChange(aspectRatio);
    });
    
    // Add hover effects
    button.addEventListener('mouseenter', function() {
      if (!this.classList.contains('active')) {
        this.style.backgroundColor = '#666;';
      }
    });
    
    button.addEventListener('mouseleave', function() {
      if (!this.classList.contains('active')) {
        this.style.backgroundColor = '#666;';
      }
    });
  });
  
  console.log('Aspect ratio buttons set up successfully');
}

$( document ).ready(function() {
  
  console.log( "ready!" );

var gui = new GUI();
gui.domElement.id = 'gui';

var width = $(".poster").width()
var height = $(".poster").height()
var data;
var line;

// Get poster element once and store globally
const posterElement = document.querySelector('.poster');

// Initialize canvas dimensions to fill poster
const posterWidth = posterElement.clientWidth;
const posterHeight = posterElement.clientHeight;
currentWidth = posterWidth;
currentHeight = posterHeight;

// Animation variables
let isAnimating = true;
let animationStartTime = 0;
const animationDuration = 2000; // 2 seconds

// Easing function for smooth animation
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/* SETUP */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.z = -500;

// Make camera globally accessible
window.camera = camera;

/* Setup the renderer */
const renderer = new SVGRenderer(); // Init a renderer
renderer.overdraw = 0; // Allow three.js to render overlapping lines
renderer.setSize(width, height); // Define its size
$(".poster").append(renderer.domElement)
renderer.domElement.setAttribute('xmlns' ,'http://www.w3.org/2000/svg'); // Add the xmlns attribute

/* Setup a new loader */
const loader = new OBJLoader();
// Load the OBJ file
loader.load('UB9.obj', (loadedData) => {
  data = loadedData;
  
  // Make data globally accessible
  window.data = data;

  data.traverse((child) => {
    if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Change color to black
    }
  });
  
  // Set initial scale to 0 for animation
  data.scale.set(0, 0, 0);
  
  // Set initial rotation for animation - start 90 degrees back on Y and slight angle on X
  data.rotation.set(-Math.PI / 6, Math.PI / 2, 0); // -30° on X, 90° on Y

  const edges = new THREE.EdgesGeometry(data.children[0].geometry,); 

  // Create a LineSegments object to visualize the edges
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
    color: 0x0000ff, linewidth: 5
  }));

  // Add the line to the scene
  line.scale.set( 1, 1, 1 );
  scene.add(data);
  
  // Start the animation
  animationStartTime = Date.now();
  isAnimating = true;
  
  // Render the scene
  renderer.render(scene, camera);

  // GUI Setup with Aspect Ratio Controls
  setupGUI();

}, 
// Progress callback
(progress) => {
  console.log('Loading progress:', progress);
},
// Error callback
(error) => {
  console.error('Error loading OBJ file:', error);
});



function setupGUI() {

  // HTML Download Button Integration
function setupDownloadButton() {
  const downloadButton = document.querySelector('.download-button');
  
  if (downloadButton) {
    // Add styling for interaction
    downloadButton.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    downloadButton.style.cursor = 'pointer';
    downloadButton.style.userSelect = 'none';
    
    // Add click event listener
    downloadButton.addEventListener('click', function() {
      downloadSVG();
    });
    
    // Add hover effects
    downloadButton.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(0.98)';
      this.style.opacity = '0.8';
    });
    
    downloadButton.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
      this.style.opacity = '1';
    });
    
    // Add active state
    downloadButton.addEventListener('mousedown', function() {
      this.style.transform = 'scale(0.95)';
    });
    
    downloadButton.addEventListener('mouseup', function() {
      this.style.transform = 'scale(0.98)';
    });
    
    console.log('Download button set up successfully');
  } else {
    console.error('Download button not found');
  }
}

// Enhanced download function that includes text overlay
function downloadSVG() {
  console.log('Download initiated');
  
  try {
    // Get the current poster HTML including SVG and text overlay
    const posterElement = document.querySelector('.poster');
    if (!posterElement) {
      console.error('Poster element not found');
      return;
    }
    
    // Clone the poster to avoid modifying the original
    const posterClone = posterElement.cloneNode(true);
    
    // Get SVG element
    const svgElement = posterClone.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    
    // Get text overlay if it exists
    const textOverlay = posterClone.querySelector('#text-overlay');
    
    if (textOverlay && textControls.showText) {
      // Convert text overlay to SVG text elements
      const textElements = textOverlay.querySelectorAll('.text-big, .text-medium, .text-small');
      const svgRect = svgElement.getBoundingClientRect();
      const posterRect = posterElement.getBoundingClientRect();
      
      textElements.forEach((textElement, index) => {
        const textContent = textElement.innerHTML.replace(/<br>/g, ' '); // Replace <br> with spaces
        const computedStyle = window.getComputedStyle(textElement);
        
        // Get text position relative to SVG
        const textRect = textElement.getBoundingClientRect();
        const relativeX = textRect.left - svgRect.left;
        const relativeY = textRect.top - svgRect.top + parseFloat(computedStyle.fontSize);
        
        // Create SVG text element
        const svgText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        svgText.setAttribute('x', relativeX);
        svgText.setAttribute('y', relativeY);
        svgText.setAttribute('fill', computedStyle.color || textControls.textColor);
        svgText.setAttribute('font-family', computedStyle.fontFamily || 'Arial, sans-serif');
        svgText.setAttribute('font-size', computedStyle.fontSize || '16px');
        svgText.setAttribute('font-weight', computedStyle.fontWeight || 'normal');
        svgText.textContent = textContent;
        
        // Add text to SVG
        svgElement.appendChild(svgText);
      });
    }
    
    // Get the SVG as string
    const svgString = new XMLSerializer().serializeToString(svgElement);
    
    // Create blob and download
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shape-system-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Download completed successfully');
    
  } catch (error) {
    console.error('Download failed:', error);
  }
}

// Alternative simpler download function (fallback)
function downloadSVGSimple() {
  const svgElement = renderer.domElement;
  if (!svgElement) {
    console.error('SVG element not found');
    return;
  }
  
  const svgString = new XMLSerializer().serializeToString(svgElement);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shape-system-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

// Add this line to your setupGUI() function at the end:
setupDownloadButton();

 // Updated setupShuffleButton function with initial hidden state
function setupShuffleButton() {
  const shuffleButton = document.querySelector('.layout-shuffle');
  
  if (shuffleButton) {
    // Initially hide the shuffle button
    shuffleButton.style.display = 'none';
    shuffleButton.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    shuffleButton.style.cursor = 'pointer';
    
    shuffleButton.addEventListener('click', function() {
      shuffleTextOrder();
    });
    
    console.log('Shuffle button set up successfully (initially hidden)');
  } else {
    console.error('Shuffle button not found');
  }
}

  // Function to update the fill percentage for any slider
  function updateSliderFill(slider) {
    const min = parseInt(slider.min) || 0;
    const max = parseInt(slider.max) || 100;
    const value = parseInt(slider.value);
    const percentage = ((value - min) / (max - min)) * 100;
    slider.style.setProperty('--fill-percent', percentage + '%');
  }

  // HTML Slider Integration for Extrude
  const extrudeSlider = document.getElementById('myRange');
  const extrudeValueDisplay = document.querySelector('.slider-outer-container:nth-child(1) .current-value');
  
  if (extrudeSlider && extrudeValueDisplay) {
    // Set initial value display and fill
    extrudeValueDisplay.textContent = extrudeSlider.value;
    updateSliderFill(extrudeSlider);
    
    // Handle slider input
    extrudeSlider.addEventListener('input', function(event) {
      const value = parseFloat(event.target.value);
      extrudeValueDisplay.textContent = value;
      updateSliderFill(event.target);
      
      if (data) {
        data.scale.set(1, 1, value); // Only scale Z-axis for true extrusion
        renderer.render(scene, camera);
      }
    });
    
    // Update slider when view presets change extrude value
    window.updateExtrudeSlider = function(newValue) {
      extrudeSlider.value = newValue;
      extrudeValueDisplay.textContent = newValue;
      updateSliderFill(extrudeSlider);
    };
  }

  // HTML Slider Integration for Scale (Camera)
  const scaleSlider = document.getElementById('scaleRange');
  const scaleValueDisplay = document.querySelector('.slider-outer-container:nth-child(2) .current-value');
  
  if (scaleSlider && scaleValueDisplay) {
    // Convert camera position to slider scale - INTUITIVE VERSION
    // Slider 1 = small shape (camera far at -500)
    // Slider 100 = big shape (camera close at -100)
    function cameraToSliderValue(cameraZ) {
      // Map -500 to -100 camera range to 1 to 100 slider range (REVERSED)
      const normalizedCamera = Math.abs(cameraZ); // Convert to positive (500 to 100)
      const percentage = (500 - normalizedCamera) / (500 - 100); // 0 to 1 (reversed)
      return Math.round(1 + percentage * 99); // 1 to 100
    }
    
    function sliderToCameraValue(sliderValue) {
      // Map 1 to 100 slider range to -500 to -100 camera range (REVERSED)
      const percentage = (sliderValue - 1) / 99; // 0 to 1
      return -(500 - percentage * 400); // -500 to -100 (reversed)
    }
    
    // Set initial value
    const initialSliderValue = cameraToSliderValue(camera.position.z);
    scaleSlider.value = initialSliderValue;
    scaleValueDisplay.textContent = initialSliderValue;
    updateSliderFill(scaleSlider);
    
    // Handle slider input
    scaleSlider.addEventListener('input', function(event) {
      const sliderValue = parseFloat(event.target.value);
      const cameraValue = sliderToCameraValue(sliderValue);
      
      scaleValueDisplay.textContent = sliderValue;
      updateSliderFill(event.target);
      
      camera.position.z = cameraValue;
      renderer.render(scene, camera);
    });
    
    // Update slider when view presets change camera value
    window.updateScaleSlider = function(newCameraZ) {
      const sliderValue = cameraToSliderValue(newCameraZ);
      scaleSlider.value = sliderValue;
      scaleValueDisplay.textContent = sliderValue;
      updateSliderFill(scaleSlider);
    };
  }

// HTML Text Switch Integration
const textSwitch = document.querySelector('.switch input[type="checkbox"]');
const textContainer = document.querySelector('.text');

// Initialize text inputs first
createTextInputs();

// Updated text switch event handler with shuffle button visibility
if (textSwitch) {
  textSwitch.addEventListener('change', function(event) {
    const textInputs = document.querySelector('.text-inputs');
    const shuffleButton = document.querySelector('.layout-shuffle');
    
    if (event.target.checked) {
      // Show text inputs with animation
      console.log("on")
      textInputs.style.display = 'flex';
      setTimeout(() => {
        textInputs.classList.add('show');
      }, 10);
      
      // Show shuffle button with animation
      if (shuffleButton) {
        shuffleButton.style.display = 'flex';
        shuffleButton.style.opacity = '0';
        shuffleButton.style.transform = `rotate(${shuffleRotation}deg)`;
        
        setTimeout(() => {
          shuffleButton.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          shuffleButton.style.opacity = '1';
          shuffleButton.style.transform = `rotate(${shuffleRotation}deg)`;
        }, 100);
      }
      
      textControls.showText = true;
      updateTextOverlay(true); // Animate text appearance
    } else {
      // Hide text inputs with animation
      textInputs.classList.remove('show');
      setTimeout(() => {
        textInputs.style.display = 'none';
      }, 300);
      
      // Hide shuffle button with animation
      if (shuffleButton) {
        shuffleButton.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        shuffleButton.style.opacity = '0';
        shuffleButton.style.transform = `rotate(${shuffleRotation}deg)`;
        
        setTimeout(() => {
          shuffleButton.style.display = 'none';
        }, 200);
      }
      
      textControls.showText = false;
      updateTextOverlay(false); // Remove text overlay
    }
  });
}

// Handle text input changes
const bigTextInput = document.getElementById('bigText');
const mediumTextInput = document.getElementById('mediumText');
const smallTextInput = document.getElementById('smallText');

if (bigTextInput) {
  bigTextInput.addEventListener('input', function(event) {
    textControls.bigText = event.target.value;
    if (textControls.showText) {
      updateTextOverlay(false);
    }
  });
}

if (mediumTextInput) {
  mediumTextInput.addEventListener('input', function(event) {
    textControls.mediumText = event.target.value;
    if (textControls.showText) {
      updateTextOverlay(false);
    }
  });
}

if (smallTextInput) {
  smallTextInput.addEventListener('input', function(event) {
    textControls.smallText = event.target.value;
    if (textControls.showText) {
      updateTextOverlay(false);
    }
  });
}

// Updated createTextInputs function with size controls for all three fields
function createTextInputs() {
  const inputsHTML = `
    <div class="text-inputs" style="display: none;">
      <div class="text-input-group">
        <div class="text-label-outer-container">
          <label class="text-input-label">Big Text</label>
          <div class="size-container" data-field="bigText">
            <div class="text-size" data-size="big">B</div>
            <div class="text-size" data-size="medium">M</div>
            <div class="text-size" data-size="small">S</div>
          </div>
        </div>
        <textarea class="text-input" id="bigText" placeholder="Enter big text" rows="2">${textControls.bigText}</textarea>
      </div>
      <div class="text-input-group">
        <div class="text-label-outer-container">
          <label class="text-input-label">Medium Text</label>
          <div class="size-container" data-field="mediumText">
            <div class="text-size" data-size="big">B</div>
            <div class="text-size" data-size="medium">M</div>
            <div class="text-size" data-size="small">S</div>
          </div>
        </div>
        <textarea class="text-input" id="mediumText" placeholder="Enter medium text" rows="2">${textControls.mediumText}</textarea>
      </div>
      <div class="text-input-group">
        <div class="text-label-outer-container">
          <label class="text-input-label">Small Text</label>
          <div class="size-container" data-field="smallText">
            <div class="text-size" data-size="big">B</div>
            <div class="text-size" data-size="medium">M</div>
            <div class="text-size" data-size="small">S</div>
          </div>
        </div>
        <textarea class="text-input" id="smallText" placeholder="Enter small text" rows="2">${textControls.smallText}</textarea>
      </div>
    </div>
  `;
  textContainer.insertAdjacentHTML('beforeend', inputsHTML);
  
  // Set up size button functionality after HTML is inserted
  setupSizeButtons();
}

// Function to set up size button functionality
function setupSizeButtons() {
  const sizeContainers = document.querySelectorAll('.size-container');
  
  sizeContainers.forEach(container => {
    const field = container.dataset.field;
    const sizeButtons = container.querySelectorAll('.text-size');
    
    // Set initial active state based on textControls
    const currentSize = textControls[field + 'Size'];
    updateSizeButtonStates(container, currentSize);
    
    // Add click handlers to each size button
    sizeButtons.forEach(button => {
      button.addEventListener('click', function() {
        const selectedSize = this.dataset.size;
        
        // Update textControls
        textControls[field + 'Size'] = selectedSize;
        
        // Update button states
        updateSizeButtonStates(container, selectedSize);
        
        // Update text overlay if text is currently showing
        if (textControls.showText) {
          updateTextOverlay(false);
        }
        
        console.log(`${field} size changed to: ${selectedSize}`);
      });
    });
  });
}

// Function to update button states (active/inactive)
function updateSizeButtonStates(container, activeSize) {
  const buttons = container.querySelectorAll('.text-size');
  
  buttons.forEach(button => {
    if (button.dataset.size === activeSize) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
}

// Updated updateTextOverlay function to use individual size settings


// Enhanced updateTextOverlay function with shuffle capability
function updateTextOverlay(shouldAnimate = false) {
  // Remove existing text overlay
  const existingOverlay = document.getElementById('text-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  if (!textControls.showText) return;

  // Get canvas dimensions and position
  const svgElement = renderer.domElement;
  if (!svgElement) return;

  const svgRect = svgElement.getBoundingClientRect();
  const posterRect = posterElement.getBoundingClientRect();
  
  // Calculate canvas position relative to poster
  const canvasLeft = svgRect.left - posterRect.left;
  const canvasTop = svgRect.top - posterRect.top;
  const canvasWidth = svgRect.width;
  const canvasHeight = svgRect.height;

  // Create text overlay container that matches canvas exactly
  const textOverlay = document.createElement('div');
  textOverlay.id = 'text-overlay';
  textOverlay.className = `text-overlay-container ${textControls.textPosition}`;
  
  // Set positioning to match canvas exactly
  textOverlay.style.position = 'absolute';
  textOverlay.style.pointerEvents = 'none';
  textOverlay.style.zIndex = '10';
  
  // Make overlay exact same size and position as canvas
  textOverlay.style.left = canvasLeft + 'px';
  textOverlay.style.top = canvasTop + 'px';
  textOverlay.style.width = canvasWidth + 'px';
  textOverlay.style.height = canvasHeight + 'px';

  // Create text elements using the current order
  let html = '';
  let elementCount = 0;
  
  // Function to convert line breaks to HTML
  function formatTextWithLineBreaks(text) {
    return text.replace(/\n/g, '<br>');
  }
  
  // Function to get CSS class based on size setting
  function getSizeClass(sizePreference) {
    switch(sizePreference) {
      case 'big': return 'text-big';
      case 'medium': return 'text-medium';
      case 'small': return 'text-small';
      default: return 'text-medium';
    }
  }

  // Build HTML based on current text order
  textOrder.forEach(textType => {
    const textContent = textControls[textType];
    const textSize = textControls[textType + 'Size'];
    
    if (textContent && textContent.trim()) {
      const animationClass = shouldAnimate ? 'text-animate' : '';
      const animationDelay = shouldAnimate ? `style="animation-delay: ${elementCount * 0.1}s;"` : '';
      const formattedText = formatTextWithLineBreaks(textContent);
      const sizeClass = getSizeClass(textSize);
      html += `<div class="${sizeClass} ${animationClass}" ${animationDelay}>${formattedText}</div>`;
      elementCount++;
    }
  });

  if (html) {
    // Add container animation class if needed
    if (shouldAnimate) {
      textOverlay.classList.add('text-container-animate');
    }
    
    textOverlay.innerHTML = html;
    posterElement.appendChild(textOverlay);
  }
}


// Enhanced shuffleTextOrder function with single element positioning
function shuffleTextOrder() {
  // Only shuffle if text is currently showing
  if (!textControls.showText) {
    console.log('Text not visible - shuffle ignored');
    return;
  }
  
  // Count how many text fields have content
  const hasContent = textOrder.filter(textType => 
    textControls[textType] && textControls[textType].trim()
  );
  
  if (hasContent.length === 0) {
    console.log('No text content to shuffle');
    return;
  }
  
  if (hasContent.length === 1) {
    // Single element - cycle through positions
    console.log('Single text element - changing position');
    
    // Cycle through: bottom -> center -> top -> bottom
    switch (singleTextPosition) {
      case 'flex-end': // bottom
        singleTextPosition = 'center';
        break;
      case 'center': // center
        singleTextPosition = 'flex-start';
        break;
      case 'flex-start': // top
        singleTextPosition = 'flex-end';
        break;
      default:
        singleTextPosition = 'flex-end';
    }
    
    console.log('New single text position:', singleTextPosition);
    
    // Update the text overlay with new positioning
    updateTextOverlay(true);
    
  } else {
    // Multiple elements - normal shuffle behavior
    console.log('Multiple text elements - shuffling order');
    
    // Reset to normal positioning when multiple elements exist
    singleTextPosition = 'flex-end';
    
    // Shuffle the order
    textOrder = shuffleArray(textOrder);
    console.log('New text order:', textOrder);
    
    // Update the text overlay with animation
    updateTextOverlay(true);
  }
  
  // Rotate the shuffle button
  shuffleRotation += 90;
  const shuffleButton = document.querySelector('.layout-shuffle');
  if (shuffleButton) {
    shuffleButton.style.transform = `rotate(${shuffleRotation}deg)`;
  }
}

// Enhanced updateTextOverlay function with dynamic positioning
function updateTextOverlay(shouldAnimate = false) {
  // Remove existing text overlay
  const existingOverlay = document.getElementById('text-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  if (!textControls.showText) return;

  // Get canvas dimensions and position
  const svgElement = renderer.domElement;
  if (!svgElement) return;

  const svgRect = svgElement.getBoundingClientRect();
  const posterRect = posterElement.getBoundingClientRect();
  
  // Calculate canvas position relative to poster
  const canvasLeft = svgRect.left - posterRect.left;
  const canvasTop = svgRect.top - posterRect.top;
  const canvasWidth = svgRect.width;
  const canvasHeight = svgRect.height;

  // Create text overlay container that matches canvas exactly
  const textOverlay = document.createElement('div');
  textOverlay.id = 'text-overlay';
  textOverlay.className = `text-overlay-container ${textControls.textPosition}`;
  
  // Set positioning to match canvas exactly
  textOverlay.style.position = 'absolute';
  textOverlay.style.pointerEvents = 'none';
  textOverlay.style.zIndex = '10';
  
  // Make overlay exact same size and position as canvas
  textOverlay.style.left = canvasLeft + 'px';
  textOverlay.style.top = canvasTop + 'px';
  textOverlay.style.width = canvasWidth + 'px';
  textOverlay.style.height = canvasHeight + 'px';

  // Count elements with content
  const elementsWithContent = textOrder.filter(textType => 
    textControls[textType] && textControls[textType].trim()
  );

  // Apply dynamic justify-content based on element count
  if (elementsWithContent.length === 1) {
    // Single element - use dynamic positioning
    textOverlay.style.justifyContent = singleTextPosition;
    console.log('Applied single text position:', singleTextPosition);
  } else if (elementsWithContent.length > 1) {
    // Multiple elements - use space-between
    textOverlay.style.justifyContent = 'space-between';
    console.log('Applied space-between for multiple elements');
  } else {
    // No elements - default
    textOverlay.style.justifyContent = 'flex-end';
  }

  // Always use flexbox layout
  textOverlay.style.display = 'flex';
  textOverlay.style.flexDirection = 'column';
  textOverlay.style.alignItems = 'flex-start'; // Maintain left alignment

  // Create text elements using the current order
  let html = '';
  let elementCount = 0;
  
  // Function to convert line breaks to HTML
  function formatTextWithLineBreaks(text) {
    return text.replace(/\n/g, '<br>');
  }
  
  // Function to get CSS class based on size setting
  function getSizeClass(sizePreference) {
    switch(sizePreference) {
      case 'big': return 'text-big';
      case 'medium': return 'text-medium';
      case 'small': return 'text-small';
      default: return 'text-medium';
    }
  }

  // Build HTML based on current text order
  textOrder.forEach(textType => {
    const textContent = textControls[textType];
    const textSize = textControls[textType + 'Size'];
    
    if (textContent && textContent.trim()) {
      const animationClass = shouldAnimate ? 'text-animate' : '';
      const animationDelay = shouldAnimate ? `style="animation-delay: ${elementCount * 0.1}s;"` : '';
      const formattedText = formatTextWithLineBreaks(textContent);
      const sizeClass = getSizeClass(textSize);
      html += `<div class="${sizeClass} ${animationClass}" ${animationDelay}>${formattedText}</div>`;
      elementCount++;
    }
  });

  if (html) {
    // Add container animation class if needed
    if (shouldAnimate) {
      textOverlay.classList.add('text-container-animate');
    }
    
    textOverlay.innerHTML = html;
    posterElement.appendChild(textOverlay);
  }
}

// Function to reset positioning when text content changes
function resetTextPositioning() {
  const elementsWithContent = textOrder.filter(textType => 
    textControls[textType] && textControls[textType].trim()
  );
  
  // Reset to bottom when content changes and we have multiple elements
  if (elementsWithContent.length > 1) {
    singleTextPosition = 'flex-end';
  }
}

   // Add HTML aspect ratio button functionality
   setupAspectRatioButtons();

  // GUI
  const myObject = {
    Download: function() { 
      // Include text overlay in download
      const posterHTML = $(".poster").html();
      dataToDownload.text = posterHTML;

      const blob = new Blob([dataToDownload.text], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dataToDownload.fileName;
      a.click(); 
    }
  }

  const rotationFolder = gui.addFolder('Rotation');
  const rotationParams = {
      x: 0,
      y: 0,
      z: 0
  };

  rotationFolder.add(rotationParams, 'x', 0, 2 * Math.PI).onChange(value => {
    if (data) {
      data.rotation.x = value;
      renderer.render(scene, camera);
    }
  });
  rotationFolder.add(rotationParams, 'y', 0, 2 * Math.PI).onChange(value => {
    if (data) {
      data.rotation.y = value;
      renderer.render(scene, camera);
    }
  });
  rotationFolder.add(rotationParams, 'z', 0, 2 * Math.PI).onChange(value => {
    if (data) {
      data.rotation.z = value;
      renderer.render(scene, camera);
    }
  });

  //download
  const dataToDownload = { 
    text: "", 
    fileName: "UBlogo.svg"
  };

  // HTML Color Item Integration
  const colorItems = document.querySelectorAll('.color-item');
  
  // Define color combinations: [shape color, background color, text color]
  const colorCombinations = [
    { shape: 0xFFFFFF, background: 0x005BBB, text: '#000000' }, // White shape on blue background, black text
    { shape: 0x002F56, background: 0x005BBB, text: '#ffffff' }, // Dark blue shape on blue background, white text  
    { shape: 0x005BBB, background: 0xFFFFFF, text: '#000000' }, // Blue shape on white background, black text
    { shape: 0x000000, background: 0xEBEC00, text: '#000000' }  // Black shape on yellow background, black text
  ];

  // Color transition variables
  let isColorTransitioning = false;
  let colorTransitionStartTime = 0;
  const colorTransitionDuration = 300; // 600ms transition
  let startColors = {};
  let targetColors = {};

  // Function to smoothly update colors with transition
  function updateColors(shapeColor, backgroundColor, textColor, animate = true) {
    if (!animate) {
      // Immediate update (for initial setup)
      if (data) {
        data.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material.color.set(shapeColor);
          }
        });
      }
      scene.background = new THREE.Color(backgroundColor);
      
      // Update text color
      textControls.textColor = textColor;
      const textOverlay = document.getElementById('text-overlay');
      if (textOverlay) {
        textOverlay.style.color = textColor;
      }
      
      renderer.render(scene, camera);
      return;
    }

    // Get current colors
    let currentShapeColor = new THREE.Color(0x000000); // Default fallback
    let currentBackgroundColor = new THREE.Color(0xFFFFFF); // Default fallback
    let currentTextColor = textControls.textColor; // Current text color
    
    if (data) {
      data.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          currentShapeColor = child.material.color.clone();
        }
      });
    }
    
    if (scene.background) {
      currentBackgroundColor = scene.background.clone();
    }

    // Set up transition
    isColorTransitioning = true;
    colorTransitionStartTime = Date.now();
    
    startColors = {
      shape: currentShapeColor,
      background: currentBackgroundColor,
      text: currentTextColor
    };
    
    targetColors = {
      shape: new THREE.Color(shapeColor),
      background: new THREE.Color(backgroundColor),
      text: textColor
    };
  }

  // Add click handlers to color items
  colorItems.forEach((colorItem, index) => {
    colorItem.addEventListener('click', function() {
      // Remove active class from all items
      colorItems.forEach(item => item.classList.remove('active'));
      
      // Add active class to clicked item
      this.classList.add('active');
      
      // Apply the color combination
      if (colorCombinations[index]) {
        updateColors(
          colorCombinations[index].shape, 
          colorCombinations[index].background,
          colorCombinations[index].text
        );
      }
    });
  });

  // Set initial color combination (first one) - no animation for initial setup
  if (colorItems.length > 0) {
    colorItems[0].classList.add('active');
    updateColors(
      colorCombinations[0].shape, 
      colorCombinations[0].background, 
      colorCombinations[0].text, 
      false
    );
  }

  // Make color transition state available globally for the animate loop
  window.colorTransitionState = {
    get isTransitioning() { return isColorTransitioning; },
    get startTime() { return colorTransitionStartTime; },
    get duration() { return colorTransitionDuration; },
    get startColors() { return startColors; },
    get targetColors() { return targetColors; },
    complete() { isColorTransitioning = false; }
  };

  // Add a checkbox to toggle wireframe mode
  const wireframeOptions = {
    wireframe: false  // Default is not wireframe
  };

  // Create the wireframe checkbox control
  const extrudeFolder = gui.addFolder('Shape');
  extrudeFolder.add(wireframeOptions, 'wireframe').onChange(function(isWireframe) {
    // Toggle the wireframe property of the material
    if (data) {
      data.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.wireframe = isWireframe;  // Enable or disable wireframe
          child.material.needsUpdate = true;  // Update material immediately
        }
      });
      renderer.render(scene, camera);
    }
  });

  gui.add( myObject, 'Download' ); // Button

  // View presets functionality
  // Create view buttons
  const viewFolder = gui.addFolder('Views');
  viewPresets.forEach((preset, index) => {
    const viewObject = {
      [preset.name]: function() {
        console.log(`Button clicked: ${preset.name}`);
        console.log('isTransitioning:', isTransitioning);
        console.log('isAnimating:', isAnimating);
        
        if (!isTransitioning && !isAnimating) {
          transitionToView(preset);
        } else {
          console.log('Transition blocked - already animating or transitioning');
        }
      }
    };
    viewFolder.add(viewObject, preset.name);
  });

  // Make updateTextOverlay available globally for canvas resize updates
  window.updateTextOverlay = updateTextOverlay;

  // ADD THIS LINE TO ACTUALLY SET UP THE SHUFFLE BUTTON:
  setupShuffleButton();

  // ADD THIS LINE TO SET UP THE SHAPE SHUFFLE BUTTON:
  setupShapeShuffleButton();
}

// Init the controller
cameraControls = new OrbitControls(camera, renderer.domElement);
cameraControls.enabled = false; // Disable controls during animation

// Configure OrbitControls to only rotate, not pan or zoom
cameraControls.enablePan = false; // Disable panning (right-click drag)
cameraControls.enableZoom = false; // Disable zooming (scroll wheel)
cameraControls.enableRotate = true; // Keep rotation enabled (left-click drag)

// Track when orbit controls are used
cameraControls.addEventListener('start', () => {
  orbitControlsUsed = true;
  console.log('Orbit controls started - flag set');
});

// Render the scene on each update of the controls
cameraControls.addEventListener('change', () => {
  renderer.render(scene, camera);
});

function animate() {
  requestAnimationFrame(animate);
  
  // Handle canvas resizing with smooth transitions
  if (canvasIsTransitioning) {
    currentWidth += (targetWidth - currentWidth) * 0.1;
    currentHeight += (targetHeight - currentHeight) * 0.1;
    
    if (Math.abs(currentWidth - targetWidth) < 1 && Math.abs(currentHeight - targetHeight) < 1) {
      currentWidth = targetWidth;
      currentHeight = targetHeight;
      canvasIsTransitioning = false;
    }
    
    camera.aspect = currentWidth / currentHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(currentWidth, currentHeight);
    
    // Update text overlay position when canvas resizes
    if (typeof updateTextOverlay === 'function') {
      updateTextOverlay(false); // Don't animate during resize
    }
    
    if (data) {
      renderer.render(scene, camera);
    }
  }
  
  // Handle entrance animation
  if (isAnimating && data) {
    const currentTime = Date.now();
    const elapsed = currentTime - animationStartTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    
    // Apply easing to the progress
    const easedProgress = easeOutCubic(progress);
    
    // Animate scale (grow from 0 to 1 on all axes for entrance)
    const scale = easedProgress;
    data.scale.set(scale, scale, scale);
    
    // Animate rotation (90 degrees on Y axis + angle on X, ending at 0,0,0)
    const rotationY = (Math.PI / 2) - (easedProgress * Math.PI / 2); // From 90° to 0°
    const rotationX = -(Math.PI / 6) + (easedProgress * Math.PI / 6); // From -30° to 0°
    data.rotation.set(rotationX, rotationY, 0);
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Check if animation is complete
    if (progress >= 1) {
      isAnimating = false;
      cameraControls.enabled = true; // Enable orbit controls after animation
      // Reset to proper scale for extrude functionality
      data.scale.set(1, 1, 1);
      renderer.render(scene, camera);
      console.log('Animation complete - OrbitControls enabled');
    }
  }
 // Update the view transition section in your animate() function:
else if (isTransitioning && data) {
  const currentTime = Date.now();
  const elapsed = currentTime - transitionStartTime;
  const progress = Math.min(elapsed / transitionDuration, 1);
  
  // Apply easing to the progress
  const easedProgress = easeOutCubic(progress);
  
  // Interpolate rotation
  data.rotation.x = startState.rotation.x + (targetState.rotation.x - startState.rotation.x) * easedProgress;
  data.rotation.y = startState.rotation.y + (targetState.rotation.y - startState.rotation.y) * easedProgress;
  data.rotation.z = startState.rotation.z + (targetState.rotation.z - startState.rotation.z) * easedProgress;
  
  // Interpolate extrusion
  const currentExtrude = startState.extrude + (targetState.extrude - startState.extrude) * easedProgress;
  data.scale.set(1, 1, currentExtrude);
  
  // Update HTML slider to match current extrude value
  if (typeof updateExtrudeSlider === 'function') {
    updateExtrudeSlider(Math.round(currentExtrude));
  }
  
  // Interpolate camera Z position
  camera.position.z = startState.camera + (targetState.camera - startState.camera) * easedProgress;
  
  // NEW: Interpolate scale (which affects camera position via slider)
  const currentScale = startState.scale + (targetState.scale - startState.scale) * easedProgress;
  const scaleCameraPosition = sliderToCameraValue(currentScale);
  camera.position.z = scaleCameraPosition;
  
  // Update HTML scale slider to match current scale value
  if (typeof updateScaleSlider === 'function') {
    updateScaleSlider(scaleCameraPosition);
  }
  
  // Render the scene
  renderer.render(scene, camera);
  
  // Check if transition is complete
  if (progress >= 1) {
    isTransitioning = false;
    console.log('View transition complete');
    
    // Final state adjustment to ensure precision
    data.rotation.set(targetState.rotation.x, targetState.rotation.y, targetState.rotation.z);
    data.scale.set(1, 1, targetState.extrude);
    
    // Set final camera position based on target scale
    const finalCameraPosition = sliderToCameraValue(targetState.scale);
    camera.position.z = finalCameraPosition;
    
    // Final slider updates
    if (typeof updateExtrudeSlider === 'function') {
      updateExtrudeSlider(targetState.extrude);
    }
    if (typeof updateScaleSlider === 'function') {
      updateScaleSlider(finalCameraPosition);
    }
    
    renderer.render(scene, camera);
  }
}
  // Handle color transitions
  else if (window.colorTransitionState && window.colorTransitionState.isTransitioning && data) {
    const currentTime = Date.now();
    const elapsed = currentTime - window.colorTransitionState.startTime;
    const progress = Math.min(elapsed / window.colorTransitionState.duration, 1);
    
    // Apply easing to the progress
    const easedProgress = easeOutCubic(progress);
    
    // Interpolate shape color
    const currentShapeColor = window.colorTransitionState.startColors.shape.clone().lerp(
      window.colorTransitionState.targetColors.shape, 
      easedProgress
    );
    
    // Interpolate background color
    const currentBackgroundColor = window.colorTransitionState.startColors.background.clone().lerp(
      window.colorTransitionState.targetColors.background, 
      easedProgress
    );
    
    // Interpolate text color (convert hex to RGB for interpolation)
    const startTextColor = hexToRgb(window.colorTransitionState.startColors.text);
    const targetTextColor = hexToRgb(window.colorTransitionState.targetColors.text);
    const currentTextColorRgb = {
      r: Math.round(startTextColor.r + (targetTextColor.r - startTextColor.r) * easedProgress),
      g: Math.round(startTextColor.g + (targetTextColor.g - startTextColor.g) * easedProgress),
      b: Math.round(startTextColor.b + (targetTextColor.b - startTextColor.b) * easedProgress)
    };
    const currentTextColor = `rgb(${currentTextColorRgb.r}, ${currentTextColorRgb.g}, ${currentTextColorRgb.b})`;
    
    // Apply colors
    data.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material.color.copy(currentShapeColor);
      }
    });
    scene.background = currentBackgroundColor;
    
    // Update text color
    textControls.textColor = currentTextColor;
    const textOverlay = document.getElementById('text-overlay');
    if (textOverlay) {
      textOverlay.style.color = currentTextColor;
    }
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Check if transition is complete
    if (progress >= 1) {
      window.colorTransitionState.complete();
      console.log('Color transition complete');
      
      // Final color adjustment to ensure precision
      data.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.color.copy(window.colorTransitionState.targetColors.shape);
        }
      });
      scene.background = window.colorTransitionState.targetColors.background;
      
      // Final text color update
      textControls.textColor = window.colorTransitionState.targetColors.text;
      const textOverlay = document.getElementById('text-overlay');
      if (textOverlay) {
        textOverlay.style.color = window.colorTransitionState.targetColors.text;
      }
      
      renderer.render(scene, camera);
    }
  }
  // Normal operation
  else if (!isAnimating) {
    // Update controls when not animating
    cameraControls.update();
  }
}

animate();

/* EVENTS */
function onWindowResize() {
  if (!canvasIsTransitioning) {
    width = $(".poster").width()
    height = $(".poster").height()
    
    // Update canvas dimensions to fit new poster size - use existing posterElement
    const currentAspectRatio = document.querySelector('#gui')?.__controllers?.[0]?.getValue() || '1:1';
    
    // Get updated poster dimensions
    const newPosterWidth = posterElement.clientWidth;
    const newPosterHeight = posterElement.clientHeight;
    
    // Update canvas dimensions based on new poster size
    const ratio = aspectRatios[currentAspectRatio];
    const canvasAspectRatio = ratio.width / ratio.height;
    const posterAspectRatio = newPosterWidth / newPosterHeight;
    
    if (canvasAspectRatio > posterAspectRatio) {
      targetWidth = newPosterWidth;
      targetHeight = newPosterWidth / canvasAspectRatio;
    } else {
      targetHeight = newPosterHeight;
      targetWidth = newPosterHeight * canvasAspectRatio;
    }
    
    canvasIsTransitioning = true;
  }
}

// Function to randomly select a view preset
function getRandomViewPreset() {
  const randomIndex = Math.floor(Math.random() * viewPresets.length);
  return viewPresets[randomIndex];
}

// Function to handle shape shuffle
function shuffleShape() {
  console.log('Shape shuffle clicked');
  
  // Don't shuffle if already transitioning or animating
  if (isTransitioning || isAnimating) {
    console.log('Shape shuffle blocked - already transitioning or animating');
    return;
  }
  
  // Get a random view preset
  const randomPreset = getRandomViewPreset();
  console.log(`Randomly selected: ${randomPreset.name}`);
  
  // Transition to the random view
  transitionToView(randomPreset);
}

// Function to set up shape shuffle button
function setupShapeShuffleButton() {
  const shapeShuffleButton = document.querySelector('.shape-shuffle');
  
  if (shapeShuffleButton) {
    // Add styling for smooth rotation and hover effects
    shapeShuffleButton.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    shapeShuffleButton.style.cursor = 'pointer';
    shapeShuffleButton.style.userSelect = 'none'; // Prevent text selection
    
    // Add click event listener
    shapeShuffleButton.addEventListener('click', function() {
      shuffleShapeNoDuplicates(); // New - prevents duplicates
    });
    
    // Add hover effect
    shapeShuffleButton.addEventListener('mouseenter', function() {
      this.style.opacity = '0.7';
    });
    
    shapeShuffleButton.addEventListener('mouseleave', function() {
      this.style.opacity = '1';
    });
    
    console.log('Shape shuffle button set up successfully');
  } else {
    console.error('Shape shuffle button not found');
  }
}

// Enhanced version with weighted random selection (optional)
function getWeightedRandomViewPreset() {
  // You can add weights if you want some presets to be more likely
  const weights = {
    'Front View': 1,
    'Isometric': 2,    // 2x more likely
    'Side View': 1,
    'Extruded': 2,     // 2x more likely  
    'Top View': 1
  };
  
  const weightedArray = [];
  viewPresets.forEach(preset => {
    const weight = weights[preset.name] || 1;
    for (let i = 0; i < weight; i++) {
      weightedArray.push(preset);
    }
  });
  
  const randomIndex = Math.floor(Math.random() * weightedArray.length);
  return weightedArray[randomIndex];
}

// Alternative shuffle function with weighted selection
function shuffleShapeWeighted() {
  console.log('Weighted shape shuffle clicked');
  
  if (isTransitioning || isAnimating) {
    console.log('Shape shuffle blocked - already transitioning or animating');
    return;
  }
  
  const randomPreset = getWeightedRandomViewPreset();
  console.log(`Randomly selected (weighted): ${randomPreset.name}`);
  
  transitionToView(randomPreset);
  
  shapeShuffleRotation += 90;
  const shapeShuffleButton = document.querySelector('.shape-shuffle');
  if (shapeShuffleButton) {
    shapeShuffleButton.style.transform = `rotate(${shapeShuffleRotation}deg)`;
  }
}

// Function to prevent same preset from being selected twice in a row
function getRandomViewPresetNoDuplicates() {
  let availablePresets = viewPresets;
  
  // If we have a last selected preset and there are other options, exclude it
  if (lastSelectedPreset && viewPresets.length > 1) {
    availablePresets = viewPresets.filter(preset => preset.name !== lastSelectedPreset.name);
  }
  
  const randomIndex = Math.floor(Math.random() * availablePresets.length);
  const selectedPreset = availablePresets[randomIndex];
  
  lastSelectedPreset = selectedPreset;
  return selectedPreset;
}

// Enhanced shuffle function that avoids duplicates
function shuffleShapeNoDuplicates() {
  console.log('Shape shuffle (no duplicates) clicked');
  
  if (isTransitioning || isAnimating) {
    console.log('Shape shuffle blocked - already transitioning or animating');
    return;
  }
  
  const randomPreset = getRandomViewPresetNoDuplicates();
  console.log(`Randomly selected (no duplicates): ${randomPreset.name}`);
  
  transitionToView(randomPreset);
}

window.addEventListener("resize", onWindowResize, false);

});