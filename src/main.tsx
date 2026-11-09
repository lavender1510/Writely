import React, {lazy,Suspense} from 'react';
import {Capacitor} from '@capacitor/core';
const SecureWorkspace=lazy(()=>import('./SecureWorkspace'));
const mobile=Capacitor.getPlatform()==='android'||new URLSearchParams(location.search).get('mobile')==='1';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/400-italic.css';
import '@fontsource/source-serif-4/600.css';
import Home from './Home';
import './styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode>{mobile?<Suspense fallback={<p>Writely wird vorbereitet …</p>}><SecureWorkspace/></Suspense>:<Home/>}</React.StrictMode>);
