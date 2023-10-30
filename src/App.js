import React, { Suspense, useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useTexture, Loader, Environment, useFBX, useAnimations, OrthographicCamera } from '@react-three/drei';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';

import { LinearEncoding, sRGBEncoding } from 'three/src/constants';
import { LineBasicMaterial, MeshPhysicalMaterial, Vector2 } from 'three';
import ReactAudioPlayer from 'react-audio-player';

import createAnimation from './converter';
import blinkData from './blendDataBlink.json';

import * as THREE from 'three';
import axios from 'axios';
const _ = require('lodash');

const host = 'http://localhost:3000'


function Avatar({ avatar_url, speak, setSpeak, text, setAudioSource, playing, makeSpeech }) {
  let gltf = useGLTF(avatar_url);
  let morphTargetDictionaryBody = null;
  let morphTargetDictionaryLowerTeeth = null;

  const [ 
    bodyTexture, 
    eyesTexture, 
    teethTexture, 
    bodySpecularTexture, 
    bodyRoughnessTexture, 
    bodyNormalTexture,
    teethNormalTexture,
    // teethSpecularTexture,
    hairTexture,
    tshirtDiffuseTexture,
    tshirtNormalTexture,
    tshirtRoughnessTexture,
    hairAlphaTexture,
    hairNormalTexture,
    hairRoughnessTexture,
    ] = useTexture([
    "/images/body.webp",
    "/images/eyes.webp",
    "/images/teeth_diffuse.webp",
    "/images/body_specular.webp",
    "/images/body_roughness.webp",
    "/images/body_normal.webp",
    "/images/teeth_normal.webp",
    // "/images/teeth_specular.webp",
    "/images/h_color.webp",
    "/images/tshirt_diffuse.webp",
    "/images/tshirt_normal.webp",
    "/images/tshirt_roughness.webp",
    "/images/h_alpha.webp",
    "/images/h_normal.webp",
    "/images/h_roughness.webp",
  ]);

  _.each([
    bodyTexture, 
    eyesTexture, 
    teethTexture, 
    teethNormalTexture, 
    bodySpecularTexture, 
    bodyRoughnessTexture, 
    bodyNormalTexture, 
    tshirtDiffuseTexture, 
    tshirtNormalTexture, 
    tshirtRoughnessTexture,
    hairAlphaTexture,
    hairNormalTexture,
    hairRoughnessTexture
  ], t => {
    t.encoding = sRGBEncoding;
    t.flipY = false;
  });

  bodyNormalTexture.encoding = LinearEncoding;
  tshirtNormalTexture.encoding = LinearEncoding;
  teethNormalTexture.encoding = LinearEncoding;
  hairNormalTexture.encoding = LinearEncoding;

  
  gltf.scene.traverse(node => {


    if(node.type === 'Mesh' || node.type === 'LineSegments' || node.type === 'SkinnedMesh') {

      node.castShadow = false;
      node.receiveShadow = false;
      node.frustumCulled = false;

    
      if (node.name.includes("Body")) {

        node.castShadow = false;
        node.receiveShadow = false;

        node.material = new MeshPhysicalMaterial();
        node.material.map = bodyTexture;
        // node.material.shininess = 60;
        node.material.roughness = 1.7;

        // node.material.specularMap = bodySpecularTexture;
        node.material.roughnessMap = bodyRoughnessTexture;
        node.material.normalMap = bodyNormalTexture;
        node.material.normalScale = new Vector2(0.6, 0.6);

        morphTargetDictionaryBody = node.morphTargetDictionary;

        node.material.envMapIntensity = 1.0;
        // node.material.visible = false;

      }

      if (node.name.includes("Eyes")) {
        node.material = new MeshStandardMaterial();
        node.material.map = eyesTexture;
        // node.material.shininess = 100;
        node.material.roughness = 0.1;
        node.material.envMapIntensity = 0.5;


      }

      if (node.name.includes("Brows")) {
        node.material = new LineBasicMaterial({color: 0x000000});
        node.material.linewidth = 1;
        node.material.opacity = 0.5;
        node.material.transparent = true;
        node.visible = false;
      }

      if (node.name.includes("Teeth")) {

        node.receiveShadow = true;
        node.castShadow = true;
        node.material = new MeshStandardMaterial();
        node.material.roughness = 0.1;
        node.material.map = teethTexture;
        node.material.normalMap = teethNormalTexture;

        node.material.envMapIntensity = 0.9;


      }

      if (node.name.includes("Hair")) {
        node.material = new MeshStandardMaterial();
        node.material.map = hairTexture;
        node.material.alphaMap = hairAlphaTexture;
        node.material.normalMap = hairNormalTexture;
        node.material.roughnessMap = hairRoughnessTexture;
        
        node.material.transparent = true;
        node.material.depthWrite = false;
        node.material.side = 2;
        node.material.color.setHex(0x000000);
        
        node.material.envMapIntensity = 0.3;

      
      }

      if (node.name.includes("TSHIRT")) {
        node.material = new MeshStandardMaterial();

        node.material.map = tshirtDiffuseTexture;
        node.material.roughnessMap = tshirtRoughnessTexture;
        node.material.normalMap = tshirtNormalTexture;
        node.material.color.setHex(0xffffff);

        node.material.envMapIntensity = 0.5;


      }

      if (node.name.includes("TeethLower")) {
        morphTargetDictionaryLowerTeeth = node.morphTargetDictionary;
      }

    }

  });

  const [clips, setClips] = useState([]);
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), []);

  useEffect(() => {

    if (speak === false)
      return;
    
    makeSpeech(text)

    .then( response => {

      let {blendData, filename}= response.data;

      let newClips = [ 
        createAnimation(blendData, morphTargetDictionaryBody, 'HG_Body'), 
        createAnimation(blendData, morphTargetDictionaryLowerTeeth, 'HG_TeethLower') ];

      filename = host + filename;
        
      setClips(newClips);
      setAudioSource(filename);

    })
    .catch(err => {
      console.error(err);
      setSpeak(false);

    })

  }, [speak, text]);

  

  let idleFbx = useFBX('/idle.fbx');
  let { clips: idleClips } = useAnimations(idleFbx.animations);

  idleClips[0].tracks = _.filter(idleClips[0].tracks, track => {
    return track.name.includes("Head") || track.name.includes("Neck") || track.name.includes("Spine2");
  });

  idleClips[0].tracks = _.map(idleClips[0].tracks, track => {

    if (track.name.includes("Head")) {
      track.name = "head.quaternion";
    }

    if (track.name.includes("Neck")) {
      track.name = "neck.quaternion";
    }

    if (track.name.includes("Spine")) {
      track.name = "spine2.quaternion";
    }

    return track;

  });

  useEffect(() => {

    let idleClipAction = mixer.clipAction(idleClips[0]);
    idleClipAction.play();

    let blinkClip = createAnimation(blinkData, morphTargetDictionaryBody, 'HG_Body');
    let blinkAction = mixer.clipAction(blinkClip);
    blinkAction.play();


  }, []);

  // Play animation clips when available
  useEffect(() => {

    if (playing === false)
      return;
    
    _.each(clips, clip => {
        let clipAction = mixer.clipAction(clip);
        clipAction.setLoop(THREE.LoopOnce);
        clipAction.play();

    });

  }, [playing]);

  
  useFrame((state, delta) => {
    mixer.update(delta);
  });


  return (
    <group name="avatar">
      <primitive object={gltf.scene} dispose={null} />
    </group>
  );
}

////







const STYLES = {
  area: {position: 'absolute', bottom:'10px', left: '10px', zIndex: 500},
  text: {margin: '0px', width:'300px', padding: '5px', background: 'none', color: '#ffffff', fontSize: '1.2em', border: 'none'},
  speak: {padding: '10px', marginTop: '5px', display: 'block', color: '#FFFFFF', background: '#222222', border: 'None'},
  area2: {position: 'absolute', top:'5px', right: '15px', zIndex: 500},
  label: {color: '#777777', fontSize:'0.8em'}
}

function App() {

  const audioPlayer = useRef();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedText, setRecordedText] = useState("");
  
  const [speak, setSpeak] = useState(false);
  const [text, setText] = useState("");
  const [audioSource, setAudioSource] = useState(null);
  const [playing, setPlaying] = useState(false);
  let recognition = null;
  if (window.webkitSpeechRecognition) {
    recognition = new (window.webkitSpeechRecognition);
  } else {
    recognition = new (window.SpeechRecognition);
  }

  recognition.lang = 'en-US';
  // recognition.isRunning = false


  
  function makeSpeech(text) {
    return axios.post(host + '/talk', { text });
  }
  function handleSpeak() {
    if (recordedText) {
      makeSpeech(text)
      
      .then(response => {
            setText(recordedText); // set the text to recordedText

        })
        .catch(error => {
            console.error("Error:", error);
        });
    }
  }


function toggleRecording() {
  if (isRecording) {
    
      recognition.stop();
      setIsRecording(false);  // Explicitly set it here
  } else {
    
      recognition.start();
      setIsRecording(true);   // Explicitly set it here
  }
}


// End of play
function playerEnded(e) {
  setAudioSource(null);
  setSpeak(false);
  setPlaying(false);
}

// Player is ready
function playerReady(e) {
  audioPlayer.current.audioEl.current.play();
  setPlaying(true);
}
// Define event handlers outside of useEffect
recognition.onstart = () => {
  setIsRecording(true);
};

recognition.onend = () => {
  setIsRecording(false);
};

recognition.onresult = (event) => {
  let transcript = Array.from(event.results)
      .map(result => result[0])
      .map(result => result.transcript)
      .join('');
  console.log('transcript', transcript);
  setRecordedText(transcript);
  setText(transcript);
};

// Your other component logic here...



  return (
    <div className="full">
        <div style={STYLES.area}>
            <button onClick={toggleRecording} style={STYLES.speak}>
                {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
            <button onClick={() => { 
              handleSpeak(); setSpeak(true);}} style={STYLES.speak}>
                {speak ? 'Running...' : 'Speak'}
            </button>
        </div>
  



      <ReactAudioPlayer
        src={audioSource}
        ref={audioPlayer}
        onEnded={playerEnded}
        onCanPlayThrough={playerReady}
        
      />
      
      {/* <Stats /> */}
    <Canvas dpr={[1, 2]} onCreated={(ctx) => {
        ctx.gl.physicallyCorrectLights = true;
      }}>

      <OrthographicCamera 
      makeDefault
      zoom={2000}
      near={0.1}
      far={100}
      position={[0, 1.65, 1]}
      />

      {/* <OrbitControls
        target={[0, 1.65, 0]}
      /> */}

      <Suspense fallback={null}>
        <Environment background={false} files="/images/photo_studio_loft_hall_1k.hdr" />
      </Suspense>

      <Suspense fallback={null}>
        <Bg />
      </Suspense>

      <Suspense fallback={null}>



          <Avatar 
            avatar_url="/model.glb" 
            speak={speak} 
            setSpeak={setSpeak}
            text={text}
            setAudioSource={setAudioSource}
            playing={playing}
            makeSpeech={makeSpeech}
            />

      
      </Suspense>

  

  </Canvas>
  <Loader dataInterpolation={(p) => `Loading... please wait`}  />
  </div>
  )
}

function Bg() {
  


}

export default App;