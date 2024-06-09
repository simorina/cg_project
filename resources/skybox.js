"use strict";

//definizone funzione main
function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  var canvas = document.getElementById("canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) {
    return;
  }

  // setup programma GLSL 
  var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader-3d", "fragment-shader-3d"]);

  // look up where the vertex data needs to go.
  var positionLocation = gl.getAttribLocation(program, "a_position");
  // lookup uniforms
  var skyboxLocation = gl.getUniformLocation(program, "u_skybox");
  var viewDirectionProjectionInverseLocation =
      gl.getUniformLocation(program, "u_viewDirectionProjectionInverse");

  // Create a buffer for positions
  var positionBuffer = gl.createBuffer();
  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Put the positions in the buffer
  setGeometry(gl);

  // Create a texture.
  //definzione texture
  var texture = gl.createTexture();
  //operazione di binding della texture
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
  //url della texture
  let myUrl = './sky.jpg'
  //facce della skybox
  const faceInfos = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: myUrl,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url:myUrl ,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url:myUrl ,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: myUrl,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: myUrl,
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: myUrl,
    },
  ];

  //settaggio formato di ogni faccia della skybox
  faceInfos.forEach((faceInfo) => {
    const {target, url} = faceInfo;
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 2048;
    const height = 2048;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;

    // setup di ogni faccia così che siano renderizzabili immediatamente
    gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

    // Caricamento immagine in maniera asincrona
    const image = new Image();
    //setting del source con l'url dell'immagine
    image.src = url;
    image.addEventListener('load', function() {
      // binding immagine nella texture.
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      // settaggio texture
      gl.texImage2D(target, level, internalFormat, format, type, image);
      //generazione mipmap
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    });
  });
  //generazione mipmap
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  //settaggio parametri texture
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);


  //funzione che converte gradi a radianti
  function degToRad(d) {
    return d * Math.PI / 180;
  }

  //settaggio FOV
  var fieldOfViewRadians = degToRad(60);

  // tempo di inizio.
  var then = 0;

  requestAnimationFrame(drawScene);

  // funzione di rendering
  function drawScene(time) {
    //conversione in secondi
    time *= 0.001;
  
    // Remember the current time for the next frame.
    then = time;

    webglUtils.resizeCanvasToDisplaySize(gl.canvas);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    //controllo del test di depth e cull
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // pulizia canvasa e buffer del depth
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //esecuzione shader program
    gl.useProgram(program);

    //attivazione dei position attribute
    gl.enableVertexAttribArray(positionLocation);

    // Binding del buffer delle posizioni.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    //esplico al poisiton attribute come estrappolare dati dal position buffer (ARRAY_BUFFER)
    var size = 2;          // 2 componenti per iterazione
    var type = gl.FLOAT;   // i dait sono 32bit floats
    var normalize = false; // non normalizzare il dato
    var stride = 0;        
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionLocation, size, type, normalize, stride, offset);

    // Computazione della matrice di proiezione
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // movimento rotatorio della camera
    var cameraPosition = [Math.cos(time * .01), 0, Math.sin(time * .01)];
    // coordinate del target
    var target = [0, 0, 0];
    // la camera sta leggermente in alto (y = 1)
    var up = [0, 1, 0];
    // Computazione della matrice usando lookAt costruendo il vettore dove punta(ovvero target spostato di up)
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);

    // costruzione di una viewMatrix usando l'inverse sulla matrice della camera
    var viewMatrix = m4.inverse(cameraMatrix);

    // We only care about direciton so remove the translation
    viewMatrix[12] = 0;
    viewMatrix[13] = 0;
    viewMatrix[14] = 0;
    
    
    var viewDirectionProjectionMatrix =
        m4.multiply(projectionMatrix, viewMatrix);
    var viewDirectionProjectionInverseMatrix =
        m4.inverse(viewDirectionProjectionMatrix);

    // settaggio degli uniforms
    gl.uniformMatrix4fv(
        viewDirectionProjectionInverseLocation, false,
        viewDirectionProjectionInverseMatrix);

      
    // Tell the shader to use texture unit 0 for u_skybox
    gl.uniform1i(skyboxLocation, 0);

    // let our quad pass the depth test at 1.0
    gl.depthFunc(gl.LEQUAL);

    // disegno vero e proprio
    gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);

    requestAnimationFrame(drawScene);
  }
}

// Fill the buffer with the values that define a quad.
function setGeometry(gl) {
  //settaggio delle geometrie delle facce di un quadrata
  var positions = new Float32Array(
    [
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
  
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
}
//esecuzione del main
main();
