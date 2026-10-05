import {loadFont as loadAmiri} from '@remotion/google-fonts/Amiri';
import {loadFont as loadReem} from '@remotion/google-fonts/ReemKufi';
import {loadFont as loadCairo} from '@remotion/google-fonts/Cairo';

import React from 'react';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
export const inter = loadInter('normal', {weights: ['500', '700', '800'], subsets: ['latin']}).fontFamily;
export const LangCtx = React.createContext<{en: boolean}>({en: false});
export const useEn = () => React.useContext(LangCtx).en;

export const amiri = loadAmiri('normal', {weights: ['400', '700'], subsets: ['arabic']}).fontFamily;
export const reem = loadReem('normal', {weights: ['600'], subsets: ['arabic']}).fontFamily;
export const cairo = loadCairo('normal', {weights: ['600', '800'], subsets: ['arabic']}).fontFamily;

export const C = {
  blueDark: '#0a4fa8',
  blue: '#0b78d1',
  blueLight: '#2aa0f0',
  ink: '#1c1c1c',
  red: '#e60000',
  paper: '#ffffff',
};

export const BG = {
  blue: `radial-gradient(circle at 50% 35%, ${C.blueLight} 0%, ${C.blue} 45%, ${C.blueDark} 100%)`,
  white: `linear-gradient(160deg, #cfe3f7 0%, #ffffff 45%, #ffffff 100%)`,
  dark: `linear-gradient(#1a1a1a, #0d0d0d)`,
};

export const useFam = () => (React.useContext(LangCtx).en ? inter : cairo);
