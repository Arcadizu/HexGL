var bkcore = bkcore || {};

bkcore.Audio = {};
bkcore.Audio.sounds = {};

// Mix levels (0..1), persisted per browser. Raw assets are mastered very hot,
// so the defaults sit well below full scale.
bkcore.Audio.MUSIC_IDS = { bg: true };
bkcore.Audio.STORAGE_KEY = 'hexgl-audio';
bkcore.Audio.settings = { master: 0.4, music: 0.6, sfx: 0.7, muted: false };
bkcore.Audio._levels = {};

bkcore.Audio.loadSettings = function(){
	try {
		var saved = JSON.parse(localStorage.getItem(bkcore.Audio.STORAGE_KEY) || 'null');
		if(saved){
			['master', 'music', 'sfx'].forEach(function(k){
				var v = parseFloat(saved[k]);
				if(!isNaN(v)) bkcore.Audio.settings[k] = Math.max(0, Math.min(1, v));
			});
			bkcore.Audio.settings.muted = saved.muted === true;
		}
	} catch(e) {}
};

bkcore.Audio.saveSettings = function(){
	try { localStorage.setItem(bkcore.Audio.STORAGE_KEY, JSON.stringify(bkcore.Audio.settings)); }
	catch(e) {}
};

bkcore.Audio.init = function(){
	bkcore.Audio.loadSettings();

	if(window.AudioContext||window.webkitAudioContext){
		var ctx = new (window.AudioContext||window.webkitAudioContext)();
		bkcore.Audio._ctx = ctx;

		// sound gain -> music/sfx bus -> master -> speakers
		bkcore.Audio._master = ctx.createGain();
		bkcore.Audio._master.connect(ctx.destination);
		bkcore.Audio._music = ctx.createGain();
		bkcore.Audio._music.connect(bkcore.Audio._master);
		bkcore.Audio._sfx = ctx.createGain();
		bkcore.Audio._sfx.connect(bkcore.Audio._master);

		bkcore.Audio._panner = ctx.createPanner();
		bkcore.Audio._panner.connect(bkcore.Audio._sfx);
	}
	else {
		bkcore.Audio._ctx = null;
	}

	bkcore.Audio.posMultipler = 1.5;
	bkcore.Audio.applySettings();
};

bkcore.Audio._busLevel = function(id){
	var st = bkcore.Audio.settings;
	if(st.muted) return 0;
	return st.master * (bkcore.Audio.MUSIC_IDS[id] ? st.music : st.sfx);
};

bkcore.Audio.applySettings = function(){
	var st = bkcore.Audio.settings;
	if(bkcore.Audio._ctx){
		bkcore.Audio._master.gain.value = st.muted ? 0 : st.master;
		bkcore.Audio._music.gain.value = st.music;
		bkcore.Audio._sfx.gain.value = st.sfx;
	}
	else {
		for(var id in bkcore.Audio.sounds){
			var lvl = bkcore.Audio._levels[id] != null ? bkcore.Audio._levels[id] : 1;
			bkcore.Audio.sounds[id].volume = lvl * bkcore.Audio._busLevel(id);
		}
	}
};

// key: 'master' | 'music' | 'sfx' (0..1) or 'muted' (bool)
bkcore.Audio.set = function(key, value){
	if(key === 'muted') bkcore.Audio.settings.muted = !!value;
	else bkcore.Audio.settings[key] = Math.max(0, Math.min(1, value));
	bkcore.Audio.applySettings();
	bkcore.Audio.saveSettings();
};

bkcore.Audio.init();

bkcore.Audio.suspend = function(){
	var ctx = bkcore.Audio._ctx;
	if(ctx && ctx.state === 'running'){
		ctx.suspend();
	}
};

bkcore.Audio.resume = function(){
	var ctx = bkcore.Audio._ctx;
	if(ctx && ctx.state === 'suspended'){
		ctx.resume();
	}
};

bkcore.Audio.addSound = function(src, id, loop, callback, usePanner){
	var ctx = bkcore.Audio._ctx;
	var audio = new Audio();
	
	if(ctx){
		var audio = { src: null, gainNode: null, bufferNode: null, loop: loop };
		var xhr = new XMLHttpRequest();
		xhr.responseType = 'arraybuffer';

		xhr.onload = function(){
			ctx.decodeAudioData(xhr.response, function(b){
				// Create Gain Node
				var gainNode = ctx.createGain();

				if(usePanner === true){
					gainNode.connect(bkcore.Audio._panner);
				}
				else if(bkcore.Audio.MUSIC_IDS[id]){
					gainNode.connect(bkcore.Audio._music);
				}
				else {
					gainNode.connect(bkcore.Audio._sfx);
				}

				// Add the audio source
				audio.src = b;

				//Remember the gain node
				audio.gainNode = gainNode;
				
				callback();
			}, function(e){
				console.error('Audio decode failed!', e);
				callback();
			});
		};
		xhr.onerror = function(){
			console.error('Audio download failed!', src);
			callback();
		};

		xhr.open('GET', src, true);
		xhr.send(null);
	}
	else {
		// Workaround for old Safari
		audio.addEventListener('canplay', function(){
			audio.pause();
			audio.currentTime = 0;

			callback();
		}, false);

		audio.autoplay = true;
		audio.loop = loop;
		audio.volume = bkcore.Audio._busLevel(id);
		audio.src = src;
	}
	
	bkcore.Audio.sounds[id] = audio;
};

bkcore.Audio.play = function(id){
	var ctx = bkcore.Audio._ctx;

	if(ctx){
		if(ctx.state === 'suspended'){
			ctx.resume();
		}
		var sound = ctx.createBufferSource();
		sound.connect(bkcore.Audio.sounds[id].gainNode);
		
		sound.buffer = bkcore.Audio.sounds[id].src;
		sound.loop = bkcore.Audio.sounds[id].loop;

		var lvl = bkcore.Audio._levels[id];
		bkcore.Audio.sounds[id].gainNode.gain.value = lvl != null ? lvl : 1;
		bkcore.Audio.sounds[id].bufferNode = sound;

		sound.start ? sound.start(0) : sound.noteOn(0);
	}
	else {
		if(bkcore.Audio.sounds[id].currentTime > 0){
			bkcore.Audio.sounds[id].pause();
			bkcore.Audio.sounds[id].currentTime = 0;
		}

		bkcore.Audio.sounds[id].play();
	}
};

bkcore.Audio.stop = function(id){
	var ctx = bkcore.Audio._ctx;

	if(ctx){
		if(bkcore.Audio.sounds[id].bufferNode !== null){
			var bufferNode = bkcore.Audio.sounds[id].bufferNode;
			bufferNode.stop ? bufferNode.stop(ctx.currentTime) : bufferNode.noteOff(ctx.currentTime);
		}
	}
	else {
		bkcore.Audio.sounds[id].pause();
		bkcore.Audio.sounds[id].currentTime = 0;
	}
};

bkcore.Audio.volume = function(id, volume){
	var ctx = bkcore.Audio._ctx;
	bkcore.Audio._levels[id] = volume;

	if(ctx){
		if(bkcore.Audio.sounds[id].gainNode)
			bkcore.Audio.sounds[id].gainNode.gain.value = volume;
	}
	else {
		bkcore.Audio.sounds[id].volume = volume * bkcore.Audio._busLevel(id);
	}
};

bkcore.Audio.setListenerPos = function(vec){
	if(bkcore.Audio._ctx){
		var panner = bkcore.Audio._panner;
		var vec2 = vec.normalize();
		var x = vec2.x * bkcore.Audio.posMultipler;
		var y = vec2.y * bkcore.Audio.posMultipler;
		var z = vec2.z * bkcore.Audio.posMultipler;
		if(panner.positionX){
			panner.positionX.value = x;
			panner.positionY.value = y;
			panner.positionZ.value = z;
		} else if(panner.setPosition){
			panner.setPosition(x, y, z);
		}
	}
};

bkcore.Audio.setListenerVelocity = function(vec){
	if(bkcore.Audio._ctx){
		var panner = bkcore.Audio._panner;
		//panner.setVelocity(vec.x, vec.y, vec.z);
	}
};