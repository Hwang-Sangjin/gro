"use client";

import { ReactLenis } from "lenis/react";

const Projects = () => {
  return (
    <ReactLenis className="projects" options={{ wrapper: undefined }}>
      <div className="projects-container">
        <div className="images">
          <img src="/img1.jpg" alt="" />
          <img src="/img2.jpg" alt="" />
          <img src="/img3.jpg" alt="" />
          <img src="/img4.jpg" alt="" />
        </div>
      </div>
    </ReactLenis>
  );
};

export default Projects;
