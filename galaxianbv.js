/* GLOBAL CONSTANTS AND VARIABLES */

/* Game-specific globals */
var gl = null; // The WebGL context

// View parameters
var Eye = vec3.fromValues(0.0, 0.0, -7.0); // Camera position
var Center = vec3.fromValues(0.0, 0.0, 0.0); // Where the camera is looking
var Up = vec3.fromValues(0.0, 1.0, 0.0); // Up vector

// Shader attribute and uniform locations
var shaderProgram;
var vPosAttribLoc;
var vNormAttribLoc;
var mMatrixULoc;
var pvmMatrixULoc;
var normalMatrixULoc;
var lightPositionULoc;
var uColorULoc;

// Alien movement variables
var alienDirection = 1; // 1 for right, -1 for left
var alienSpeed = 0.02; // Adjust the speed as needed
var alienLeftLimit = -3.0; // Left boundary for aliens
var alienRightLimit = 3.0; // Right boundary for aliens

// Alien color change variables
var colorChangeInterval = 3000; // Time in milliseconds (3000 ms = 3 seconds)
var lastColorChangeTime = 0;
var currentAlienColor = [1.0, 0.0, 0.0, 1.0]; // Start with red
var alternateAlienColor = [0.0, 0.0, 1.0, 1.0]; // Blue color

// Alien descent variables
var lastDescentTime = 0;
var descentInterval = 5000; // Time between descents in milliseconds
var descentGap = 1000; // Time between consecutive descending aliens (1 second)
var descendingAliens = []; // Array to keep track of descending aliens

var lowerRowY = 1.5; // Y-position of the lower row of aliens

// Game over flag
var gameOverFlag = false;

// Spaceship projectile variables
var spaceshipShot = null; // Holds the projectile model when shot
var shotSpeed = 0.1; // Speed at which the shot moves upwards

// Alien projectile variables
var alienProjectiles = []; // Array to hold all alien projectiles
var alienProjectileSpeed = 0.08; // Speed of alien projectiles (greater than alien's descent speed)

// Model data
var spaceshipModel = {};
var alienModels = [];

// Input state variables
var keysPressed = {};
var spaceshipSpeed = 0.05; // Adjust the speed as needed

function setupBackground() {
  var imageCanvas = document.getElementById("myImageCanvas");
  var imageContext = imageCanvas.getContext("2d");

  var bgImg = new Image();
  bgImg.src = "sky.png"; // Ensure this image is in the same directory or correct path
  bgImg.onload = function () {
    // Once the image loads, draw it to fill the entire canvas
    imageContext.drawImage(bgImg, 0, 0, imageCanvas.width, imageCanvas.height);
  };
}

function setupWebGL() {
  var canvas = document.getElementById("myWebGLCanvas");
  // Request alpha channel
  gl = canvas.getContext("webgl", { alpha: true });

  try {
    if (gl == null) {
      throw "Unable to create WebGL context";
    } else {
      gl.clearDepth(1.0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      // Clear with transparent background
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 0.0); // alpha = 0.0 for transparency
    }
  } catch (e) {
    console.log(e);
  }
}

// Set up shaders
function setupShaders() {
  var vShaderCode = `
    attribute vec3 aVertexPosition;
    attribute vec3 aVertexNormal;

    uniform mat4 umMatrix;
    uniform mat4 upvmMatrix;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main(void) {
        vPosition = vec3(umMatrix * vec4(aVertexPosition, 1.0));
        vNormal = normalize(uNormalMatrix * aVertexNormal);
        gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);
    }
  `;

  var fShaderCode = `
    precision mediump float;

    varying vec3 vNormal;
    varying vec3 vPosition;

    uniform vec3 uLightPosition;
    uniform vec4 uColor;

    void main(void) {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(uLightPosition - vPosition);

        // Ambient light
        float ambientStrength = 0.5;
        vec3 ambient = ambientStrength * uColor.rgb;

        // Diffuse light
        float diff = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diff * uColor.rgb;

        vec3 result = ambient + diffuse;
        gl_FragColor = vec4(result, uColor.a);
    }
  `;

  // Compile vertex shader
  var vShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vShader, vShaderCode);
  gl.compileShader(vShader);
  if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the vertex shader:",
      gl.getShaderInfoLog(vShader)
    );
    gl.deleteShader(vShader);
    return;
  }

  // Compile fragment shader
  var fShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fShader, fShaderCode);
  gl.compileShader(fShader);
  if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the fragment shader:",
      gl.getShaderInfoLog(fShader)
    );
    gl.deleteShader(fShader);
    return;
  }

  // Create shader program
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vShader);
  gl.attachShader(shaderProgram, fShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error(
      "Unable to initialize the shader program:",
      gl.getProgramInfoLog(shaderProgram)
    );
    return;
  }

  // Use the shader program
  gl.useProgram(shaderProgram);

  // Get attribute and uniform locations
  vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(vPosAttribLoc);

  vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(vNormAttribLoc);

  mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix");
  pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix");
  normalMatrixULoc = gl.getUniformLocation(shaderProgram, "uNormalMatrix");
  lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
  uColorULoc = gl.getUniformLocation(shaderProgram, "uColor");
}

// Create spaceship model as a pyramid with normals
function createSpaceshipModel() {
  // Define positions and normals for a pyramid with flat shading
  var positions = [
    // Base face (bottom)
    -0.1,
    -0.1,
    0.1, // 0
    0.1,
    -0.1,
    0.1, // 1
    0.1,
    -0.1,
    -0.1, // 2
    -0.1,
    -0.1,
    -0.1, // 3

    // Side face 1
    -0.1,
    -0.1,
    0.1, // 4
    0.1,
    -0.1,
    0.1, // 5
    0.0,
    0.1,
    0.0, // 6

    // Side face 2
    0.1,
    -0.1,
    0.1, // 7
    0.1,
    -0.1,
    -0.1, // 8
    0.0,
    0.1,
    0.0, // 9

    // Side face 3
    0.1,
    -0.1,
    -0.1, // 10
    -0.1,
    -0.1,
    -0.1, // 11
    0.0,
    0.1,
    0.0, // 12

    // Side face 4
    -0.1,
    -0.1,
    -0.1, // 13
    -0.1,
    -0.1,
    0.1, // 14
    0.0,
    0.1,
    0.0, // 15
  ];

  var normals = [
    // Base face normal (downward)
    0.0,
    -1.0,
    0.0, // 0
    0.0,
    -1.0,
    0.0, // 1
    0.0,
    -1.0,
    0.0, // 2
    0.0,
    -1.0,
    0.0, // 3

    // Side face 1 normal
    0.0,
    0.7071,
    0.7071, // 4
    0.0,
    0.7071,
    0.7071, // 5
    0.0,
    0.7071,
    0.7071, // 6

    // Side face 2 normal
    0.7071,
    0.7071,
    0.0, // 7
    0.7071,
    0.7071,
    0.0, // 8
    0.7071,
    0.7071,
    0.0, // 9

    // Side face 3 normal
    0.0,
    0.7071,
    -0.7071, // 10
    0.0,
    0.7071,
    -0.7071, // 11
    0.0,
    0.7071,
    -0.7071, // 12

    // Side face 4 normal
    -0.7071,
    0.7071,
    0.0, // 13
    -0.7071,
    0.7071,
    0.0, // 14
    -0.7071,
    0.7071,
    0.0, // 15
  ];

  var indices = [
    // Base face (two triangles)
    0, 1, 2, 0, 2, 3,

    // Side face 1
    4, 5, 6,

    // Side face 2
    7, 8, 9,

    // Side face 3
    10, 11, 12,

    // Side face 4
    13, 14, 15,
  ];

  // Create and bind position buffer
  spaceshipModel.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spaceshipModel.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Create and bind normal buffer
  spaceshipModel.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, spaceshipModel.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  // Create and bind index buffer
  spaceshipModel.indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, spaceshipModel.indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  spaceshipModel.indexCount = indices.length;
  spaceshipModel.color = [0.0, 1.0, 0.0, 1.0]; // Green color
  spaceshipModel.position = vec3.fromValues(0.0, -2.4, -0.8); // Spaceship position
}

// Create alien models as cubes with normals
function createAlienModels() {
  // Define positions and normals for a cube with flat shading
  var positions = [
    // Front face
    -0.1,
    -0.1,
    0.1, // 0
    0.1,
    -0.1,
    0.1, // 1
    0.1,
    0.1,
    0.1, // 2
    -0.1,
    0.1,
    0.1, // 3
    // Back face
    -0.1,
    -0.1,
    -0.1, // 4
    0.1,
    -0.1,
    -0.1, // 5
    0.1,
    0.1,
    -0.1, // 6
    -0.1,
    0.1,
    -0.1, // 7
    // Top face
    -0.1,
    0.1,
    0.1, // 8
    0.1,
    0.1,
    0.1, // 9
    0.1,
    0.1,
    -0.1, // 10
    -0.1,
    0.1,
    -0.1, // 11
    // Bottom face
    -0.1,
    -0.1,
    0.1, // 12
    0.1,
    -0.1,
    0.1, // 13
    0.1,
    -0.1,
    -0.1, // 14
    -0.1,
    -0.1,
    -0.1, // 15
    // Right face
    0.1,
    -0.1,
    0.1, // 16
    0.1,
    0.1,
    0.1, // 17
    0.1,
    0.1,
    -0.1, // 18
    0.1,
    -0.1,
    -0.1, // 19
    // Left face
    -0.1,
    -0.1,
    0.1, // 20
    -0.1,
    0.1,
    0.1, // 21
    -0.1,
    0.1,
    -0.1, // 22
    -0.1,
    -0.1,
    -0.1, // 23
  ];

  var normals = [
    // Front face normals
    0.0,
    0.0,
    1.0, // 0
    0.0,
    0.0,
    1.0, // 1
    0.0,
    0.0,
    1.0, // 2
    0.0,
    0.0,
    1.0, // 3
    // Back face normals
    0.0,
    0.0,
    -1.0, // 4
    0.0,
    0.0,
    -1.0, // 5
    0.0,
    0.0,
    -1.0, // 6
    0.0,
    0.0,
    -1.0, // 7
    // Top face normals
    0.0,
    1.0,
    0.0, // 8
    0.0,
    1.0,
    0.0, // 9
    0.0,
    1.0,
    0.0, // 10
    0.0,
    1.0,
    0.0, // 11
    // Bottom face normals
    0.0,
    -1.0,
    0.0, // 12
    0.0,
    -1.0,
    0.0, // 13
    0.0,
    -1.0,
    0.0, // 14
    0.0,
    -1.0,
    0.0, // 15
    // Right face normals
    1.0,
    0.0,
    0.0, // 16
    1.0,
    0.0,
    0.0, // 17
    1.0,
    0.0,
    0.0, // 18
    1.0,
    0.0,
    0.0, // 19
    // Left face normals
    -1.0,
    0.0,
    0.0, // 20
    -1.0,
    0.0,
    0.0, // 21
    -1.0,
    0.0,
    0.0, // 22
    -1.0,
    0.0,
    0.0, // 23
  ];

  var indices = [
    // Front face
    0, 1, 2, 0, 2, 3,
    // Back face
    4, 5, 6, 4, 6, 7,
    // Top face
    8, 9, 10, 8, 10, 11,
    // Bottom face
    12, 13, 14, 12, 14, 15,
    // Right face
    16, 17, 18, 16, 18, 19,
    // Left face
    20, 21, 22, 20, 22, 23,
  ];

  // Create aliens in a grid
  var rows = 2;
  var cols = 6;
  var spacingX = 1.0; // Increased spacing to accommodate larger cubes
  var spacingY = 1.0;
  var startX = -((cols - 1) * spacingX) / 2;
  var startY = 2.5; // Aliens positioned higher up

  for (var i = 0; i < rows; i++) {
    for (var j = 0; j < cols; j++) {
      var alien = {};

      // Create and bind position buffer
      alien.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, alien.vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
      );

      // Create and bind normal buffer
      alien.normalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, alien.normalBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

      // Create and bind index buffer
      alien.indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, alien.indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW
      );

      alien.indexCount = indices.length;
      alien.color = currentAlienColor; // Use currentAlienColor

      var xPos = startX + j * spacingX;
      var yPos = startY - i * spacingY;
      alien.position = vec3.fromValues(xPos, yPos, 0.0);
      alien.originalPosition = vec3.clone(alien.position); // Store original position

      // Add descending properties
      alien.isDescending = false;
      alien.descendStartTime = 0;
      alien.sinAmplitude = 0;

      alienModels.push(alien);
    }
  }
}

// Create projectile model
function createProjectileModel(color) {
  // Define positions and normals for a small cube
  var positions = [
    // Front face
    -0.05, -0.05, 0.05, 0.05, -0.05, 0.05, 0.05, 0.05, 0.05, -0.05, 0.05, 0.05,
    // Back face
    -0.05, -0.05, -0.05, 0.05, -0.05, -0.05, 0.05, 0.05, -0.05, -0.05, 0.05,
    -0.05,
    // Left face
    -0.05, -0.05, -0.05, -0.05, -0.05, 0.05, -0.05, 0.05, 0.05, -0.05, 0.05,
    -0.05,
    // Right face
    0.05, -0.05, -0.05, 0.05, -0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, -0.05,
    // Top face
    -0.05, 0.05, -0.05, -0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, -0.05,
    // Bottom face
    -0.05, -0.05, -0.05, -0.05, -0.05, 0.05, 0.05, -0.05, 0.05, 0.05, -0.05,
    -0.05,
  ];

  var normals = [
    // Front face normals
    0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    // Back face normals
    0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
    // Left face normals
    -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
    // Right face normals
    1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
    // Top face normals
    0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
    // Bottom face normals
    0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
  ];

  var indices = [
    // Front face
    0, 1, 2, 0, 2, 3,
    // Back face
    4, 5, 6, 4, 6, 7,
    // Left face
    8, 9, 10, 8, 10, 11,
    // Right face
    12, 13, 14, 12, 14, 15,
    // Top face
    16, 17, 18, 16, 18, 19,
    // Bottom face
    20, 21, 22, 20, 22, 23,
  ];

  var projectile = {};

  // Create and bind position buffer
  projectile.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, projectile.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Create and bind normal buffer
  projectile.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, projectile.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  // Create and bind index buffer
  projectile.indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, projectile.indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
  );

  projectile.indexCount = indices.length;
  projectile.color = color; // Use the specified color
  projectile.position = vec3.create(); // Will set when shot

  return projectile;
}

// Render models
function renderModels() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var pMatrix = mat4.create();
  var vMatrix = mat4.create();
  var pvMatrix = mat4.create();

  var fieldOfView = (60 * Math.PI) / 180;
  var aspectRatio = gl.canvas.clientWidth / gl.canvas.clientHeight;
  var near = 0.1;
  var far = 100.0;
  mat4.perspective(pMatrix, fieldOfView, aspectRatio, near, far);

  mat4.lookAt(vMatrix, Eye, Center, Up);
  mat4.multiply(pvMatrix, pMatrix, vMatrix);

  // Render spaceship
  renderModel(spaceshipModel, pvMatrix);

  // Render aliens
  for (var i = 0; i < alienModels.length; i++) {
    renderModel(alienModels[i], pvMatrix);
  }

  // Render spaceship shot if it exists
  if (spaceshipShot !== null) {
    renderModel(spaceshipShot, pvMatrix);
  }

  // Render alien projectiles
  for (var i = 0; i < alienProjectiles.length; i++) {
    renderModel(alienProjectiles[i], pvMatrix);
  }

  // Check for errors
  var error = gl.getError();
  if (error !== gl.NO_ERROR) {
    console.error("WebGL Error:", error);
  }
}

// Render a single model
function renderModel(model, pvMatrix) {
  var mMatrix = mat4.create();
  mat4.translate(mMatrix, mMatrix, model.position);

  // Adjust scaling based on the model
  if (model === spaceshipModel) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(2.5, 2.5, 2.5));
  } else if (alienModels.includes(model)) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(2.0, 2.0, 2.0));
  } else if (model === spaceshipShot) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(1.5, 1.5, 1.5)); // Scale the shot
  } else if (alienProjectiles.includes(model)) {
    mat4.scale(mMatrix, mMatrix, vec3.fromValues(1.5, 1.5, 1.5)); // Scale alien projectile
  }

  var pvmMatrix = mat4.create();
  mat4.multiply(pvmMatrix, pvMatrix, mMatrix);

  // Calculate normal matrix
  var normalMatrix = mat3.create();
  mat3.normalFromMat4(normalMatrix, mMatrix);

  // Bind position buffer and set attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
  gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0);

  // Bind normal buffer and set attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
  gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0);

  // Set uniforms
  gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix);
  gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix);
  gl.uniformMatrix3fv(normalMatrixULoc, false, normalMatrix);
  gl.uniform3fv(lightPositionULoc, [2.0, 5.0, -3.0]); // Light position
  gl.uniform4fv(uColorULoc, model.color);

  // Bind the index buffer and draw elements
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
  gl.drawElements(gl.TRIANGLES, model.indexCount, gl.UNSIGNED_SHORT, 0);
}

// Set up event handlers for keyboard input
function setupEventHandlers() {
  window.addEventListener(
    "keydown",
    function (event) {
      keysPressed[event.key] = true;

      // Handle space bar press
      if (event.key === " " && spaceshipShot === null) {
        // Shoot a projectile
        spaceshipShot = createProjectileModel([1.0, 1.0, 0.0, 1.0]); // Yellow color
        vec3.copy(spaceshipShot.position, spaceshipModel.position);
        spaceshipShot.position[1] += 0.3; // Position the shot above the spaceship
      }
    },
    false
  );

  window.addEventListener(
    "keyup",
    function (event) {
      keysPressed[event.key] = false;
    },
    false
  );
}

// Function to start an alien descent
function startAlienDescent(currentTime) {
  // Find aliens that are not descending
  var availableAliens = alienModels.filter((alien) => !alien.isDescending);

  if (availableAliens.length > 0) {
    // Randomly select an alien
    var index = Math.floor(Math.random() * availableAliens.length);
    var alien = availableAliens[index];

    // Set descending properties
    alien.isDescending = true;
    alien.descendStartTime = currentTime;
    alien.sinAmplitude = Math.random() * 0.5 + 0.5; // Amplitude between 0.5 and 1.0
    alien.hasStartedShooting = false;

    // Add to descending aliens list
    descendingAliens.push(alien);
  }
}

// Function to update descending aliens
function updateDescendingAliens(currentTime) {
  var descentSpeed = 0.04; // Adjust descent speed as needed
  var frequency = 2.0; // Frequency for sinusoidal movement

  for (var i = descendingAliens.length - 1; i >= 0; i--) {
    var alien = descendingAliens[i];

    // Store previous position before updating
    var prevPosition = vec3.clone(alien.position);

    // Update vertical position
    alien.position[1] -= descentSpeed;

    // Update horizontal position with sinusoidal movement
    var elapsedTime = (currentTime - alien.descendStartTime) / 1000; // Convert to seconds
    alien.position[0] +=
      alien.sinAmplitude * Math.sin(frequency * elapsedTime) * 0.02;

    // Check if alien has passed below lower row and hasn't started shooting
    if (!alien.hasStartedShooting && alien.position[1] <= lowerRowY) {
      alien.hasStartedShooting = true;

      // Compute the alien's trajectory slope
      var dx = alien.position[0] - prevPosition[0];
      var dy = alien.position[1] - prevPosition[1];
      var slope = dy !== 0 ? dx / dy : 0;
      var projectileSlope = -slope;

      // Start shooting three projectiles
      shootAlienProjectiles(alien, projectileSlope);
    }

    // Check for collision with spaceship
    if (checkCollision(alien, spaceshipModel)) {
      // Handle collision (game over)
      gameOver();
      return; // Exit the animation loop
    }

    // Remove alien if it goes off-screen
    if (alien.position[1] < -3.0) {
      resetAlienPosition(alien);
      descendingAliens.splice(i, 1);
    }
  }
}

// Function to reset alien position after descent
function resetAlienPosition(alien) {
  alien.isDescending = false;
  alien.hasStartedShooting = false;
  alien.position = vec3.clone(alien.originalPosition);
}

// Function to shoot alien projectiles
function shootAlienProjectiles(alien, projectileSlope) {
  var numProjectiles = 3;
  var intervalBetweenShots = 500; // Time in milliseconds between shots

  for (let i = 0; i < numProjectiles; i++) {
    setTimeout(function () {
      // Create a projectile
      var projectile = createProjectileModel([1.0, 0.0, 0.0, 1.0]); // Red color
      vec3.copy(projectile.position, alien.position);

      // Set projectile properties
      projectile.slope = projectileSlope;
      projectile.isAlienProjectile = true;

      // Add to alien projectiles array
      alienProjectiles.push(projectile);
    }, i * intervalBetweenShots);
  }
}

// Function to update alien projectiles
function updateAlienProjectiles() {
  for (var i = alienProjectiles.length - 1; i >= 0; i--) {
    var projectile = alienProjectiles[i];

    // Update projectile position
    projectile.position[1] -= alienProjectileSpeed;
    projectile.position[0] += projectile.slope * alienProjectileSpeed;

    // Check for collision with spaceship
    if (checkCollision(projectile, spaceshipModel)) {
      // Handle collision (game over)
      gameOver();
      return; // Exit the animation loop
    }

    // Remove projectile if it goes off-screen
    if (
      projectile.position[1] < -3.5 ||
      projectile.position[0] < -4.0 ||
      projectile.position[0] > 4.0
    ) {
      alienProjectiles.splice(i, 1);
    }
  }
}

function checkCollision(a, b) {
  // Determine sizes based on models
  var aSize = null;
  var bSize = null;

  // Collision margin to adjust the collision box sizes
  var collisionMargin = 0.07; // Adjust this value as needed

  // Determine size for model 'a'
  if (a === spaceshipModel) {
    var spaceshipWidth = 0.2 * 2.5 - collisionMargin; // 0.5 - margin
    var spaceshipHeight = 0.2 * 2.5 - collisionMargin; // 0.5 - margin
    aSize = { width: spaceshipWidth, height: spaceshipHeight };
  } else if (alienModels.includes(a)) {
    var alienWidth = 0.2 * 2.0 - collisionMargin; // 0.4 - margin
    var alienHeight = 0.2 * 2.0 - collisionMargin; // 0.4 - margin
    aSize = { width: alienWidth, height: alienHeight };
  } else if (a === spaceshipShot || alienProjectiles.includes(a)) {
    var shotWidth = 0.1 * 1.5 - collisionMargin; // 0.15 - margin
    var shotHeight = 0.1 * 1.5 - collisionMargin; // 0.15 - margin
    aSize = { width: shotWidth, height: shotHeight };
  } else {
    // Unrecognized model 'a'
    return false;
  }

  // Determine size for model 'b' (same logic)
  if (b === spaceshipModel) {
    var spaceshipWidth = 0.2 * 2.5 - collisionMargin;
    var spaceshipHeight = 0.2 * 2.5 - collisionMargin;
    bSize = { width: spaceshipWidth, height: spaceshipHeight };
  } else if (alienModels.includes(b)) {
    var alienWidth = 0.2 * 2.0 - collisionMargin;
    var alienHeight = 0.2 * 2.0 - collisionMargin;
    bSize = { width: alienWidth, height: alienHeight };
  } else if (b === spaceshipShot || alienProjectiles.includes(b)) {
    var shotWidth = 0.1 * 1.5 - collisionMargin;
    var shotHeight = 0.1 * 1.5 - collisionMargin;
    bSize = { width: shotWidth, height: shotHeight };
  } else {
    // Unrecognized model 'b'
    return false;
  }

  // Calculate bounding boxes
  var aLeft = a.position[0] - aSize.width / 2;
  var aRight = a.position[0] + aSize.width / 2;
  var aBottom = a.position[1] - aSize.height / 2;
  var aTop = a.position[1] + aSize.height / 2;

  var bLeft = b.position[0] - bSize.width / 2;
  var bRight = b.position[0] + bSize.width / 2;
  var bBottom = b.position[1] - bSize.height / 2;
  var bTop = b.position[1] + bSize.height / 2;

  // Check for overlap
  var xOverlap = aLeft < bRight && aRight > bLeft;
  var yOverlap = aBottom < bTop && aTop > bBottom;

  return xOverlap && yOverlap;
}

// Game over function
function gameOver() {
  gameOverFlag = true;
  alert("Game Over!");
}

function main() {
  setupWebGL();
  setupShaders();
  createSpaceshipModel();
  createAlienModels();
  setupEventHandlers();

  // Set up the background now
  setupBackground();

  // Start the rendering loop
  requestAnimationFrame(animate);
}

// Animation loop
function animate(currentTime) {
  // Handle initial currentTime
  if (!lastColorChangeTime) {
    lastColorChangeTime = currentTime;
    lastDescentTime = currentTime;
  }

  // Handle input
  if (keysPressed["ArrowLeft"]) {
    spaceshipModel.position[0] -= spaceshipSpeed;
  }
  if (keysPressed["ArrowRight"]) {
    spaceshipModel.position[0] += spaceshipSpeed;
  }

  // Limit the spaceship's movement to the screen bounds
  var leftLimit = -3.5; // Adjust these values based on your scene
  var rightLimit = 3.5;
  if (spaceshipModel.position[0] < leftLimit) {
    spaceshipModel.position[0] = leftLimit;
  }
  if (spaceshipModel.position[0] > rightLimit) {
    spaceshipModel.position[0] = rightLimit;
  }

  // Move aliens
  for (var i = 0; i < alienModels.length; i++) {
    var alien = alienModels[i];
    if (!alien.isDescending) {
      alien.position[0] += alienDirection * alienSpeed;
    }
  }

  // Check if aliens reached the boundaries
  var aliensAtLeftLimit = alienModels.some(
    (alien) => !alien.isDescending && alien.position[0] <= alienLeftLimit
  );
  var aliensAtRightLimit = alienModels.some(
    (alien) => !alien.isDescending && alien.position[0] >= alienRightLimit
  );

  if (aliensAtLeftLimit || aliensAtRightLimit) {
    alienDirection *= -1; // Reverse direction
  }

  // Color change logic
  if (currentTime - lastColorChangeTime >= colorChangeInterval) {
    // Swap colors
    var tempColor = currentAlienColor;
    currentAlienColor = alternateAlienColor;
    alternateAlienColor = tempColor;

    // Update aliens' colors
    for (var i = 0; i < alienModels.length; i++) {
      alienModels[i].color = currentAlienColor;
    }

    lastColorChangeTime = currentTime;
  }

  // Schedule alien descents
  if (currentTime - lastDescentTime >= descentInterval) {
    // Start first alien descent
    startAlienDescent(currentTime);
    // Schedule second alien descent after descentGap
    setTimeout(function () {
      startAlienDescent(currentTime + descentGap);
    }, descentGap);
    lastDescentTime = currentTime;
  }

  // Update descending aliens
  updateDescendingAliens(currentTime);

  // Update spaceship shot
  if (spaceshipShot !== null) {
    // Move the shot upwards
    spaceshipShot.position[1] += shotSpeed;

    // Check for collisions with aliens
    for (var i = 0; i < alienModels.length; i++) {
      var alien = alienModels[i];
      if (checkCollision(spaceshipShot, alien)) {
        // Destroy the alien and remove it from the array
        alienModels.splice(i, 1);
        i--; // Adjust index due to removal

        // Remove the shot
        spaceshipShot = null;

        // Exit the loop since the shot is destroyed
        break;
      }
    }

    // Remove the shot if it goes off-screen
    if (spaceshipShot !== null && spaceshipShot.position[1] > 3.5) {
      spaceshipShot = null;
    }
  }

  // Update alien projectiles
  updateAlienProjectiles();

  // If game over, do not continue
  if (gameOverFlag) return;

  renderModels();
  requestAnimationFrame(animate);
}
