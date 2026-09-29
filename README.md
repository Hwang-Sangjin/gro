# Grooves R3F listening room prototype

Geometry-only 3D prototype for the existing Hero Canvas.
Includes a sunset window on one wall, skyline, sofa, table, record console,
speaker, lamp and rotating vinyl. No external model assets or new packages.

Copy src/components/home/ListeningRoomScene.jsx into your project.
To preview, replace the contents of src/components/home/HeroScene.jsx with:

"use client";
export { default } from "./ListeningRoomScene";

Keep the original HeroScene.jsx to restore the current image scene.
The component adjusts the existing camera and restores it on unmount.
Reduced motion disables record rotation. Existing Canvas visibility pausing remains active.
PaperFadePass remains unchanged and affects the 3D room as it did the image.

This is an unrendered geometry prototype, not a faithful reconstruction of the reference image.
The room and framing require visual review in your app. No Next.js build or browser
render could be run because the shared source omits package.json and the runtime setup.
