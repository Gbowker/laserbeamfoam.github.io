document.addEventListener("DOMContentLoaded", () => {

    const site_nav = document.getElementById("site-nav");
    const copyright = document.createElement("div");
    copyright.innerHTML="Copyright (C) 2025 laserbeamFoam"
    // img2.src = "../images/github.png";
    // img2.alt = "Example image";
    copyright.classList.add("copyright");   // add class here
    site_nav.appendChild(copyright);


    const main_header = document.getElementById("main-header");
    const img = document.createElement("img");
    img.src = "../images/github.png";
    img.alt = "Example image";
    img.classList.add("github-img");   // add class here
    main_header.appendChild(img);
    
    img.addEventListener("click",()=>{
        window.open("https://github.com/laserbeamfoam");
    });

    const activeLink = document.querySelector('.nav-list-link.active');

    if (activeLink && activeLink.innerHTML.trim() === "Home") {
        
    const utilities = document.getElementById("utilities");
    const solvers = document.getElementById("solvers");
    const publications = document.getElementById("publications");
    const contact = document.getElementById("contact");
    
    utilities.addEventListener("click",()=>{
        window.location.href = "/utilities/utilities.html";
    })
    
    solvers.addEventListener("click",()=>{
        window.location.href = "/solvers/solvers.html";
    })

        publications.addEventListener("click",()=>{
        window.location.href = "/publications/publications.html";
    })

    contact.addEventListener("click",()=>{
        window.location.href = "/contact/contact.html";
    })
    }

});
