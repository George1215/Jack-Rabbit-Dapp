import '@testing-library/jest-dom';
import {TextEncoder,TextDecoder} from 'util';
global.TextEncoder=TextEncoder;
global.TextDecoder=TextDecoder;
window.scrollTo=jest.fn();
window.matchMedia=jest.fn().mockImplementation(query=>({matches:false,media:query,addListener:jest.fn(),removeListener:jest.fn(),addEventListener:jest.fn(),removeEventListener:jest.fn(),dispatchEvent:jest.fn()}));
