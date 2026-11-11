import './styles.css';
import { App } from './ui/app';

const root = document.getElementById('app');
const canvas = document.getElementById('flow');
if (root && canvas instanceof HTMLCanvasElement) new App(root, canvas);
