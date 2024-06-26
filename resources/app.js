

//VARIABILI GLOBALI
//settaggio camera
let cameraX = 0
let cameraY = 500
let cameraZ = 0
//definzione matrice della camera
let camera = m4.identity()
//traslazione camera
m4.translate(camera,cameraX,cameraY,cameraZ,camera)
//canvas
var canvas;
//gl
var gl;
//shader program degli oggetti
var meshProgramInfo;
//matrice del jet per trasformazioni
var jetMatrix = m4.identity();

//CODE FLOW
main();
"use strict";
// funzione utilizzata per effettuare il parsing di un file .obj
function parseOBJ(text) {
	
	const objPositions = [[0, 0, 0]];
	const objTexcoords = [[0, 0]];
	const objNormals = [[0, 0, 0]];
	const objColors = [[0, 0, 0]];


	const objVertexData = [
		objPositions,
		objTexcoords,
		objNormals,
		objColors,
	];

	
	let webglVertexData = [
		[],   // positions
		[],   // texcoords
		[],   // normals
		[],   // colors
	];

	const materialLibs = [];
	const geometries = [];
	let geometry;
	let groups = ['default'];
	let material = 'default';
	let object = 'default';

	const noop = () => { };

	function newGeometry() {
		// If there is an existing geometry and it's
		// not empty then start a new one.
		if (geometry && geometry.data.position.length) {
			geometry = undefined;
		}
	}

	function setGeometry() {
		if (!geometry) {
			const position = [];
			const texcoord = [];
			const normal = [];
			const color = [];
			webglVertexData = [
				position,
				texcoord,
				normal,
				color,
			];
			geometry = {
				object,
				groups,
				material,
				data: {
					position,
					texcoord,
					normal,
					color,
				},
			};
			geometries.push(geometry);
		}
	}

	function addVertex(vert) {
		const ptn = vert.split('/');
		ptn.forEach((objIndexStr, i) => {
			if (!objIndexStr) {
				return;
			}
			const objIndex = parseInt(objIndexStr);
			const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
			webglVertexData[i].push(...objVertexData[i][index]);
			if (i === 0 && objColors.length > 1) {
				geometry.data.color.push(...objColors[index]);
			}
		});
	}


	// parsing e founding delle parole chiave nell'obj
	const keywords = {
		v(parts) {
			// if there are more than 3 values here they are vertex colors
			if (parts.length > 3) {
				objPositions.push(parts.slice(0, 3).map(parseFloat));
				objColors.push(parts.slice(3).map(parseFloat));
			} else {
				objPositions.push(parts.map(parseFloat));
			}
		},
		vn(parts) {
			objNormals.push(parts.map(parseFloat));
		},
		vt(parts) {
			// should check for missing v and extra w?
			objTexcoords.push(parts.map(parseFloat));
		},
		f(parts) {
			setGeometry();
			const numTriangles = parts.length - 2;
			for (let tri = 0; tri < numTriangles; ++tri) {
				addVertex(parts[0]);
				addVertex(parts[tri + 1]);
				addVertex(parts[tri + 2]);
			}
		},
		s: noop,    
		mtllib(parts, unparsedArgs) {
			materialLibs.push(unparsedArgs);
		},
		usemtl(parts, unparsedArgs) {
			material = unparsedArgs;
			newGeometry();
		},
		g(parts) {
			groups = parts;
			newGeometry();
		},
		o(parts, unparsedArgs) {
			object = unparsedArgs;
			newGeometry();
		},
	};

	//regular expression per parsare il file obj
	const keywordRE = /(\w*)(?: )*(.*)/;
	const lines = text.split('\n');
	//parsing effettivo del file
	for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
		const line = lines[lineNo].trim();
		if (line === '' || line.startsWith('#')) {
			continue;
		}
		const m = keywordRE.exec(line);
		if (!m) {
			continue;
		}
		const [, keyword, unparsedArgs] = m;
		const parts = line.split(/\s+/).slice(1);
		if (keyword === "vt" && parts.length > 2)
			parts.pop()
		const handler = keywords[keyword];
		if (!handler) {
			console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
			continue;
		}
		handler(parts, unparsedArgs);
	}

	// remove any arrays that have no entries.
	for (const geometry of geometries) {
		geometry.data = Object.fromEntries(
			Object.entries(geometry.data).filter(([, array]) => array.length > 0));
	}

	return {
		geometries,
		materialLibs,
	};
}

function parseMapArgs(unparsedArgs) {
	// TODO: handle options
	return unparsedArgs;
}

// funzione per il parsing del fil e.mtl del file .obj
function parseMTL(text) {
	const materials = {};
	let material;

	const keywords = {
		newmtl(parts, unparsedArgs) {
			material = {};
			materials[unparsedArgs] = material;
		},
		//parsing di ogni parametro tramite keyword del file .mtl(materiale dell'obj)
		//se presente  parts.map(parseFloat); significa che è un valore
		Ns(parts) { material.shininess = parseFloat(parts[0]); },
		Ka(parts) { material.ambient = parts.map(parseFloat); },
		Kd(parts) { material.diffuse = parts.map(parseFloat); },
		Ks(parts) { material.specular = parts.map(parseFloat); },
		Ke(parts) { material.emissive = parts.map(parseFloat); },
		//se presente parseMapArgs(unparsedArgs) significa che è un vettore
		map_Ka(parts, unparsedArgs) { material.ambientMap = parseMapArgs(unparsedArgs); },
		map_Kd(parts, unparsedArgs) { material.diffuseMap = parseMapArgs(unparsedArgs); },
		map_Ns(parts, unparsedArgs) { material.specularMap = parseMapArgs(unparsedArgs); },
		// in realtà il parametro map_Bump è una normalMap ma blender tramuta nel mtl sotto il nome di map_Bump
		//non è chiaro il motivo forse dovuto al fatto che normalMap è un'evoluzione della bump_Map
		//oppure perchè la bump viene chiamata HeightMap di solito.
		map_Bump(parts, unparsedArgs) { material.normalMap = parseMapArgs(unparsedArgs); },
		Ni(parts) { material.opticalDensity = parseFloat(parts[0]); },
		d(parts) { material.opacity = parseFloat(parts[0]); },
		illum(parts) { material.illum = parseInt(parts[0]); },

	};

	//regex delle keyword
	const keywordRE = /(\w*)(?: )*(.*)/;
	const lines = text.split('\n');
	for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
		const line = lines[lineNo].trim();
		if (line === '' || line.startsWith('#')) {
			continue;
		}
		const m = keywordRE.exec(line);
		if (!m) {
			continue;
		}
		const [, keyword, unparsedArgs] = m;
		const parts = line.split(/\s+/).slice(1);
		if (keyword === "vt")
			console.log(parts);
		const handler = keywords[keyword];
		if (!handler) {
			// warning nel caso non si gestisca un parametro dell'mtl
			console.warn('unhandled keyword:', keyword);  
			continue;
		}
		handler(parts, unparsedArgs);
	}

	return materials;
}

// funzione per controllare che l'immagine sia di dimensione potenza di 2.
function isPowerOf2(value) {
	return (value & (value - 1)) === 0;
}

//associazione del singolo pixel con la texture
function create1PixelTexture(gl, pixel) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
		new Uint8Array(pixel));
	return texture;
}
// metodo per la creazione della texture
function createTexture(gl, url) {
	const texture = create1PixelTexture(gl, [128, 192, 255, 255]);
	// Asynchronously load an image
	const image = new Image();
	image.src = url;
	image.addEventListener('load', function () {
		// Now that the image has loaded make copy it to the texture.
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

		
		if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
			// Generazione mipmap.
			gl.generateMipmap(gl.TEXTURE_2D);
		} else {
			// se non in potenza di 2 disattivo mipmap e setto il wrapping a clamp to edge
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		}
	});
	return texture;
}

//metodo per generare le tangenti per la normalMap
function generateTangents(position, texcoord, indices) {
	const getNextIndex = indices ? makeIndexIterator(indices) : makeUnindexedIterator(position);
	const numFaceVerts = getNextIndex.numElements;
	const numFaces = numFaceVerts / 3;
  
	const tangents = [];
	for (let i = 0; i < numFaces; ++i) {
	  const n1 = getNextIndex();
	  const n2 = getNextIndex();
	  const n3 = getNextIndex();
  
	  const p1 = position.slice(n1 * 3, n1 * 3 + 3);
	  const p2 = position.slice(n2 * 3, n2 * 3 + 3);
	  const p3 = position.slice(n3 * 3, n3 * 3 + 3);
  
	  const uv1 = texcoord.slice(n1 * 2, n1 * 2 + 2);
	  const uv2 = texcoord.slice(n2 * 2, n2 * 2 + 2);
	  const uv3 = texcoord.slice(n3 * 2, n3 * 2 + 2);
  
	  const dp12 = m4.subtractVectors(p2, p1);
	  const dp13 = m4.subtractVectors(p3, p1);
  
	  const duv12 = subtractVector2(uv2, uv1);
	  const duv13 = subtractVector2(uv3, uv1);
  
	  const f = 1.0 / (duv12[0] * duv13[1] - duv13[0] * duv12[1]);
	  const tangent = Number.isFinite(f)
		? m4.normalize(m4.scaleVector(m4.subtractVectors(
			m4.scaleVector(dp12, duv13[1]),
			m4.scaleVector(dp13, duv12[1]),
		  ), f))
		: [1, 0, 0];
  
	  tangents.push(...tangent, ...tangent, ...tangent);
	}
  
	return tangents;
  }

//metodo aggiuntivo per l'elaborazione della normalMap
function makeIndexIterator(indices) {
let ndx = 0;
const fn = () => indices[ndx++];
fn.reset = () => { ndx = 0; };
fn.numElements = indices.length;
return fn;
}
//metodo aggiuntivo per l'elaborazione della normalMap
function makeUnindexedIterator(positions) {
let ndx = 0;
const fn = () => ndx++;
fn.reset = () => { ndx = 0; };
fn.numElements = positions.length / 3;
return fn;
}
  
const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

//funzione per il caricamento del modello obj
async function loadModel(path) {
	const objHref = path;
	const response = await fetch(objHref);
	const text = await response.text();
	const obj = parseOBJ(text);
	const baseHref = new URL(objHref, window.location.href);
	const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
		const matHref = new URL(filename, baseHref).href;
		const response = await fetch(matHref);
		return await response.text();
	}));
	const materials = parseMTL(matTexts.join('\n'));

	const textures = {
		defaultWhite: create1PixelTexture(gl, [255, 255, 255, 255]),
		defaultNormal: create1PixelTexture(gl, [127, 127, 255, 0]),
	};

	// caricamento texture per il materiale
	for (const material of Object.values(materials)) {
		Object.entries(material)
			.filter(([key]) => key.endsWith('Map'))
			.forEach(([key, filename]) => {
				let texture = textures[filename];
				if (!texture) {
					const textureHref = new URL(filename, baseHref).href;
					texture = createTexture(gl, textureHref);
					textures[filename] = texture;
				}
				material[key] = texture;
			});
	}


	
	//settaggio degli uniform di un materiale di default
	const defaultMaterial = {
		diffuse: [1, 1, 1],
		diffuseMap: textures.defaultWhite,
		normalMap: textures.defaultNormal,
		ambientMap: textures.defaultWhite,
		ambient: [0, 0, 0],
		specular: [1, 1, 1],
		specularMap: textures.defaultWhite,
		shininess: 400,
		opacity: 1,
	};

	// parts interessante ========
	const parts = obj.geometries.map(({ material, data }) => {
		if (data.color) {
			if (data.position.length === data.color.length) {
				data.color = { numComponents: 3, data: data.color };
			}
		} else {
			// there are no vertex colors so just use constant white
			data.color = { value: [1, 1, 1, 1] };
		}

		 // generate tangents if we have the data to do so.
		if (data.texcoord && data.normal) {
			data.tangent = generateTangents(data.position, data.texcoord);
		} else {
			// There are no tangents
			data.tangent = { value: [1, 0, 0] };
		}

		// create a buffer for each array by calling
		// gl.createBuffer, gl.bindBuffer, gl.bufferData
		const bufferInfo = webglUtils.createBufferInfoFromArrays(gl, data);
		return {
			material: {
				...defaultMaterial,
				...materials[material],
			},
			bufferInfo,
		};
	});

	function getExtents(positions) {
		const min = positions.slice(0, 3);
		const max = positions.slice(0, 3);
		for (let i = 3; i < positions.length; i += 3) {
			for (let j = 0; j < 3; ++j) {
				const v = positions[i + j];
				min[j] = Math.min(v, min[j]);
				max[j] = Math.max(v, max[j]);
			}
		}
		return { min, max };
	}

	function getGeometriesExtents(geometries) {
		return geometries.reduce(({ min, max }, { data }) => {
			const minMax = getExtents(data.position);
			return {
				min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
				max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
			};
		}, {
			min: Array(3).fill(Number.POSITIVE_INFINITY),
			max: Array(3).fill(Number.NEGATIVE_INFINITY),
		});
	}

	const extents = getGeometriesExtents(obj.geometries);
	const range = m4.subtractVectors(extents.max, extents.min);

	return { parts, range };
	//end==
}



//MAIN
async function main() {
	// Get A WebGL context
	/** @type {HTMLCanvasElement} */
	canvas = document.querySelector("#canvas");
	gl = canvas.getContext("webgl");
	if (!gl) {
		console.log("errore");
	}
	//vertex shader dei modelli obj
	const vs = `
	attribute vec4 a_position;
	attribute vec3 a_normal;
	attribute vec3 a_tangent;
	attribute vec2 a_texcoord;
	attribute vec4 a_color;
  
	uniform mat4 u_projection;
	uniform mat4 u_view;
	uniform mat4 u_world;
	uniform vec3 u_viewWorldPosition;
  
	varying vec3 v_normal;
	varying vec3 v_tangent;
	varying vec3 v_surfaceToView;
	varying vec2 v_texcoord;
	varying vec4 v_color;
  
	void main() {
	  vec4 worldPosition = u_world * a_position;
	  gl_Position = u_projection * u_view * worldPosition;
	  v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
	  mat3 normalMat = mat3(u_world);
	  v_normal = normalize(normalMat * a_normal);
	  v_tangent = normalize(normalMat * a_tangent);
  
	  v_texcoord = a_texcoord;
	  v_color = a_color;
	}
	`;
	//fragment shader dei modelli obj
	const fs = `
	precision highp float;
  
	varying vec3 v_normal;
	varying vec3 v_tangent;
	varying vec3 v_surfaceToView;
	varying vec2 v_texcoord;
	varying vec4 v_color;
  
	uniform vec3 diffuse;
	uniform sampler2D diffuseMap;
	uniform vec3 ambient;
	uniform vec3 emissive;
	uniform vec3 specular;
	uniform sampler2D specularMap;
	uniform float shininess;
	uniform sampler2D normalMap;
	uniform sampler2D ambientMap;
	uniform float opacity;
	uniform vec3 u_lightDirection;
	uniform vec3 u_ambientLight;
  
	void main () {
	  vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
	  vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
	  vec3 bitangent = normalize(cross(normal, tangent));
  
	  mat3 tbn = mat3(tangent, bitangent, normal);
	  normal = texture2D(normalMap, v_texcoord).rgb * 2. - 1.;
	  normal = normalize(tbn * normal);
  
	  vec3 surfaceToViewDirection = normalize(v_surfaceToView);
	  vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);
  
	  float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
	  float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
	  vec4 specularMapColor = texture2D(specularMap, v_texcoord);
	  vec3 effectiveSpecular = specular * specularMapColor.rgb;
  
	  vec4 diffuseMapColor = texture2D(diffuseMap, v_texcoord);
	  vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
	  float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;
	  
	  vec4 ambientMapColor = texture2D(ambientMap, v_texcoord);
	  vec3 effectiveAmbient = ambient * ambientMapColor.rgb;
	  gl_FragColor = vec4(
		  emissive +
		  ambient * u_ambientLight +
		  effectiveDiffuse * fakeLight +
		  effectiveSpecular * pow(specularLight, shininess),
		  effectiveOpacity);
	}
	`;


	// compila e collega gli shaders
	meshProgramInfo = webglUtils.createProgramInfo(gl, [vs, fs]);


	/*INIZIO CARICAMENTO MODELLI*/

	//caricamento modello del deserto
	var desert = await loadModel('models/desert/desert.obj')
	//caricamento modello del jet
	var jet = await loadModel('models/jet/13890_Spaceship_Ferry_v1_L3.obj')
	//caricamento del cubo
  	var cube = await loadModel('models/cubeMine/test_simo.obj')
	//caricamento della torre eiffel
	var eiffelTower = await loadModel('models/eiffel/10067_Eiffel_Tower_v1_max2010_it1.obj')
	//caricamento del colosseo
	var colosseum = await loadModel('models/colosseum/10064_colosseum_v1_Iteration0.obj')
	//caricamento del gatto
	var cat = await loadModel('models/cat/12221_Cat_v1_l3.obj')
	
	/*FINE CARICAMENTO MODELLI*/


	//settaggio camera
	//raggio camera
	const radius = m4.length(jet.range) * 5 ;
	//posizione camera
	let cameraPosition = [cameraX, cameraY, cameraZ]
	const zNear = radius / 100;
	const zFar = radius * 4;

	//definizione della posizione della luce
	let lightPosition = [-1, 3, 10]; 
	//settaggio testo per le co
	document.getElementById('xValue').textContent = "X: " + lightPosition[0]
	let xLight=document.getElementById('sliderLightX')
	document.getElementById('yValue').textContent = "Y: " + lightPosition[1]
	let yLight=document.getElementById('sliderLightY')
	document.getElementById('zValue').textContent = "Z: " + lightPosition[2]
	let zLight=document.getElementById('sliderLightZ')

	//gestione slider posizione X della luce
	xLight.addEventListener('input', function() {
		lightPosition[0] = xLight.value
		document.getElementById('xValue').textContent = 'X: ' + lightPosition[0]
	});
	//gestione slider posizione Y della luce
	yLight.addEventListener('input', function() {
		lightPosition[1] = yLight.value
		document.getElementById('yValue').textContent = 'Y: ' + lightPosition[1]
	});
	//gestione slider posizione Z della luce
	zLight.addEventListener('input', function() {
		lightPosition[2] = zLight.value
		document.getElementById('zValue').textContent = 'Z: ' + lightPosition[2]
	});

	
	//slider per la gestione del fov
	const slider = document.getElementById('slider');
	//valore iniziale fov
	let fieldOfViewRadians=degToRad(90);
	//funzione modifica del fov
	slider.addEventListener('input', function() {
	  fieldOfViewRadians = degToRad(slider.value);
	  document.getElementById('fovValue').textContent = slider.value + " degrees"
	  
	  
	});

	//settaggio del FOV (in radianti)
	document.getElementById('fovValue').textContent = slider.value + " degrees"

	//funzione di rendering
	function render(time) {
		//conversione in secondi
		time *= 0.001;  
		
		//settaggio resize del canvas
		webglUtils.resizeCanvasToDisplaySize(gl.canvas);
		//settaggio viewport
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		//test profondità
		gl.enable(gl.DEPTH_TEST);


		//aspect ratio
		const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
		//proiezione
		const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);


		// Make a view matrix from the camera matrix.
		const view = m4.inverse(camera);


		// unfirom condivisi nello shader
		const sharedUniforms = {
			u_lightDirection: m4.normalize(lightPosition),
			u_view: view,
			u_projection: projection,
			u_viewWorldPosition: cameraPosition,
		};

		//uso dello shader program
		gl.useProgram(meshProgramInfo.program);

		//settaggio direzione della luce
		sharedUniforms.u_lightDirection = m4.normalize(lightPosition),

		//settaggio uniforms tramit webgl utils
		webglUtils.setUniforms(meshProgramInfo, sharedUniforms);

		//copia della posizione della camera su una nuova u_world che sarà quella del jet

		//copia della matrice di spostamento della camera
		let u_world = m4.copy(camera);

		//traslazione del jet per creare un offset ottenendo un POV7
		// del jet da dietro
		u_world = m4.translate(u_world, 0, -100, -150)


		//caricamento del jet nel canvas e rendering
		for (const { bufferInfo, material } of jet.parts) {
			// chiamata gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
			webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
			// chiamata gl.uniform
			webglUtils.setUniforms(meshProgramInfo, {
				u_world,
			}, material);
			// chiamata gl.drawArrays or gl.drawElements
			webglUtils.drawBufferInfo(gl, bufferInfo);
		}
		


		// matrice deserto(terreno)
		u_world = m4.identity();
		// traslazione del deserto
		m4.translate(u_world,0,100,0,u_world)
		// scaling del deserto
		m4.scale(u_world,1000,1000,1000,u_world)
		
		//caricamento del modello finale
		for (const { bufferInfo, material } of desert.parts) {
			// chiamata a gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
			webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
			// chiamata gl.uniform
			webglUtils.setUniforms(meshProgramInfo, {
				u_world,
			}, material);
			// chiamata gl.drawArrays o gl.drawElements
			webglUtils.drawBufferInfo(gl, bufferInfo);
		}

		//caricamento del cubo
		u_world = m4.identity()
		//rotazione del cubo
		m4.translate(u_world,-6000,1000,-400,u_world)
		//rotazione costante nel tempo su Y
		m4.yRotate(u_world,time,u_world)
		//scaling cubo
		m4.scale(u_world,1000,1000,1000,u_world)
		//rotazione cubo su X
		m4.xRotate(u_world,degToRad(-90),u_world)
		//caricamento del cubo nel programma e disegno
		for (const { bufferInfo, material } of cube.parts) {
			// chiamata gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
			webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
			// chiamata gl.uniform
			webglUtils.setUniforms(meshProgramInfo, {
				u_world,
			}, material);
			// chiamata gl.drawArrays or gl.drawElements
			webglUtils.drawBufferInfo(gl, bufferInfo);
		}

		

		//caricamento della torrei eiffel
		//ridefinizione matrice
		u_world = m4.identity()
		//traslazione torre
		m4.translate(u_world,6000,200,0,u_world)
		//scaling torre
		m4.scale(u_world,0.1,0.1,0.1,u_world)
		//rotazione torre
		m4.xRotate(u_world,degToRad(-90),u_world)
		//caricamento e disegno della torre
		for (const { bufferInfo, material } of eiffelTower.parts) {
			// chiamata gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
			webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
			// chiamata gl.uniform
			webglUtils.setUniforms(meshProgramInfo, {
				u_world,
			}, material);
			// chiamata gl.drawArrays or gl.drawElements
			webglUtils.drawBufferInfo(gl, bufferInfo);
		}


		//caricamento del colosseo
		u_world = m4.identity()
		//traslazione del colosseo
		m4.translate(u_world,0,200,-5000,u_world)
		//scaling del colosseo
		m4.scale(u_world,0.1,0.1,0.1,u_world)
		//rotazione del colosseo
		m4.xRotate(u_world,degToRad(-90),u_world)
		//caricamento e disegno del colosseo
		for (const { bufferInfo, material } of colosseum.parts) {
			// chiamata gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
			webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
			// chiamata gl.uniform
			webglUtils.setUniforms(meshProgramInfo, {
				u_world,
			}, material);
			// chiamata gl.drawArrays or gl.drawElements
			webglUtils.drawBufferInfo(gl, bufferInfo);
		}

		//caricamento del cat
		u_world = m4.identity()
		//traslazione del cat
		m4.translate(u_world,0,200,5000,u_world)
		//scaling del colosseo
		m4.scale(u_world,20,20,20,u_world)
		//rotazione del colosseo
		m4.xRotate(u_world,degToRad(-90),u_world)
		m4.zRotate(u_world,degToRad(180),u_world)
		//caricamento e disegno del colosseo
		for (const { bufferInfo, material } of cat.parts) {
			// chiamata gl.bindBuffer, gl.enableVertexAttribArray, gl.vertexAttribPointer
			webglUtils.setBuffersAndAttributes(gl, meshProgramInfo, bufferInfo);
			// chiamata gl.uniform
			webglUtils.setUniforms(meshProgramInfo, {
				u_world,
			}, material);
			// chiamata gl.drawArrays or gl.drawElements
			webglUtils.drawBufferInfo(gl, bufferInfo);
		}
		
		
		
		
		//chiamata a funzione dell'aggiornamento della camera e del jet(POV sul jet)
		updateJetAndCameraPosition(4)
		requestAnimationFrame(render);
	}
	requestAnimationFrame(render);
}
// funzione che converte gradi in radianti
function degToRad(deg) {
	return deg * Math.PI / 180;
}

//definzione oggetto con comandi per il movimento del jet e della camera
const keys = {
	w: false,
	a: false,
	s: false,
	d: false,
	f: false,
	g: false
  };

// aggiunta event listeners per eventi di pressione e rilascio del tasto
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

//metoodo per controllare il pulsante premuto
function handleKeyDown(event) {
  keys[event.key] = true;
}
//metoodo per controllare il pulsante rilasciato
function handleKeyUp(event) {
  keys[event.key] = false;
}



// Event listeners per i bottoni direzionali per il mobile
document.querySelectorAll(".btn").forEach(function(button) {
	//acquisizione comando
	const keyCode = button.getAttribute("data-key");
	
	// pulsante premuto(funziona sia per mobile che non)
	button.addEventListener("touchstart", function(e) {
	  keys[keyCode] = true;
	  updateJetAndCameraPosition(5);
	});
	// pulsante rilasciato(funziona sia per mobile che non)
	button.addEventListener("touchend", function(e) {
		keys[keyCode] = false;
		updateJetAndCameraPosition(5);
	  });
  });

// funzione di rendering per spostare camera e jet
function updateJetAndCameraPosition(velocity){

  //movimento in avanti
  if (keys['w']) {
	//traslazione su asse Z della camera
    m4.translate(camera, 0, 0, -velocity, camera);
	//traslazione su asse Z del jet
	m4.translate(jetMatrix,0, 0, -velocity, jetMatrix);
	
  }
  //movimento a sinistra
  if (keys['a']) {
	
	//traslazione camera
	m4.translate(camera, -velocity, 0, 0, camera);
	//traslazione jet
	m4.translate(jetMatrix,-velocity, 0, 0, jetMatrix);
	//rotazione jet
	m4.yRotate(jetMatrix,0.05,jetMatrix)
	//rotazione camera
	m4.yRotate(camera,0.05,camera)
	
	
  }
  //retromarcia
  if (keys['s']) {
	//traslazione camera
    m4.translate(camera, 0, 0, velocity, camera);
	//traslazione jet
	m4.translate(jetMatrix,0, 0, velocity, jetMatrix);
  }
  //movimento a destra
  if (keys['d']) {
	//traslazione camera
	m4.translate(camera, velocity, 0, 0, camera);
	//traslazione jet
	m4.translate(jetMatrix,velocity, 0, 0, jetMatrix);
	//rotazione jet
	m4.yRotate(jetMatrix,-0.05,jetMatrix)
	//rotazione camera
	m4.yRotate(camera,-0.05,camera)
	
  }
  //inclina vista verso il basso
  if(keys['f']){
	//rotazione jet
	m4.xRotate(jetMatrix,degToRad(-0.4),jetMatrix)
	//rotazione camera
	m4.xRotate(camera,degToRad(-0.4),camera)
  }
 //inclina vista verso l'alto
  if(keys['g']){
	//rotazione jet
	m4.xRotate(jetMatrix,degToRad(0.4),jetMatrix)
	//rotazione camera
	m4.xRotate(camera,degToRad(0.4),camera)
  }
}
