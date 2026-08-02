import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PoseLabPage } from '../pages/training/PoseLabPage'
import '../styles/global.css'

createRoot(document.getElementById('root')!).render(<StrictMode><PoseLabPage /></StrictMode>)
