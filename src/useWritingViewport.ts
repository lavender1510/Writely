import {useEffect} from 'react';
import type {Editor} from '@tiptap/react';
/** Uses the actual WebView viewport; no guessed keyboard height or timed focus. */
export function useWritingViewport(editor:Editor|null){useEffect(()=>{
  const viewport=window.visualViewport;let previous=viewport?.height||innerHeight,frame=0;
  const update=()=>{const height=viewport?.height||innerHeight;document.documentElement.style.setProperty('--writing-height',`${height}px`);if(previous-height>100&&editor?.isFocused){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!editor.isDestroyed)editor.view.dispatch(editor.state.tr.scrollIntoView());});}previous=height;};
  update();viewport?.addEventListener('resize',update);window.addEventListener('resize',update);
  return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',update);window.removeEventListener('resize',update);document.documentElement.style.removeProperty('--writing-height');};
},[editor]);}
