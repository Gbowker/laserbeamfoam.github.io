// const navLink = document.querySelector('.nav-list-link.active');
// const whereToStart = document.getElementById('where-to-start');

// document.addEventListener("DOMContentLoaded", function () {
//     const navLinks = document.querySelectorAll('.nav-list-link');
//     // navLinks.forEach(link => {
//     // console.log(link.innerHTML);
//     // })

//     navLinks.forEach(link => {
//         if(link.innerHTML=="Home"){
//             link.addEventListener('click', function (e) {
//             const content = link.innerHTML;
//             console.log(content);
//         }); 
//         }else if(link.innerHTML=="Solvers"){
//             link.addEventListener('click', function (e) {
//             const content = link.innerHTML;
//             console.log(content);
//          });
//         }else if(link.innerHTML=="Utilities"){
//             link.addEventListener('click', function (e) {
//                 const content = link.innerHTML;
//                 console.log(content);
//                 });
//         }else if(link.innerHTML=="Publications"){
//                 link.addEventListener('click', function (e) {
//                 const content = link.innerHTML;
//                 console.log(content);
//                 });   
//             }
//     });
// })

document.addEventListener("DOMContentLoaded", () => {
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

//   navLinks.forEach(link => {
//     link.addEventListener("click", () => {
//       window.location.href = "/docs/page-name/";
//     });
//   });
});
