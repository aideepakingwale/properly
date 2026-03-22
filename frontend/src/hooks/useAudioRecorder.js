import { useRef, useState, useCallback } from 'react';

function getMimeType() {
  const types=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];
  return types.find(t=>MediaRecorder.isTypeSupported(t))||'';
}

export function useAudioRecorder() {
  const mrRef     = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError]             = useState(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:{ channelCount:1, sampleRate:16000, echoCancellation:true, noiseSuppression:true, autoGainControl:true }
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mt = getMimeType();
      const mr = new MediaRecorder(stream, mt?{mimeType:mt}:{});
      mrRef.current = mr;
      mr.ondataavailable = e=>{ if(e.data.size>0) chunksRef.current.push(e.data); };
      mr.start(100);
      setIsRecording(true);
      return true;
    } catch(err) {
      const msg = err.name==='NotAllowedError'
        ? 'Microphone permission denied. Please allow access in your browser settings.'
        : err.name==='NotFoundError'
        ? 'No microphone found. Please connect a microphone and try again.'
        : `Microphone error: ${err.message}`;
      setError(msg);
      return false;
    }
  },[]);

  const stopRecording = useCallback(()=>new Promise(resolve=>{
    const mr=mrRef.current;
    if(!mr||mr.state==='inactive'){ resolve(null); return; }
    mr.onstop=()=>{
      const blob=new Blob(chunksRef.current,{type:mr.mimeType||'audio/webm'});
      chunksRef.current=[];
      streamRef.current?.getTracks().forEach(t=>t.stop());
      setIsRecording(false);
      resolve(blob);
    };
    mr.stop();
  }),[]);

  const cancelRecording = useCallback(()=>{
    mrRef.current?.stop();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    chunksRef.current=[];
    setIsRecording(false);
  },[]);

  return { startRecording, stopRecording, cancelRecording, isRecording, error };
}
