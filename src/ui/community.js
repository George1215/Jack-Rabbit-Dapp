// Only confirmed destinations are enabled. Configure official accounts before release.
export const REPOSITORY_URL="https://github.com/George1215/Jack-Rabbit-Dapp/tree/jack-rabbit-final";
function safe(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}}
export const SOCIALS=[
 {name:"X",icon:"x",url:safe(process.env.REACT_APP_SOCIAL_X)},
 {name:"Telegram",icon:"telegram",url:safe(process.env.REACT_APP_SOCIAL_TELEGRAM)},
 {name:"Discord",icon:"discord",url:safe(process.env.REACT_APP_SOCIAL_DISCORD)},
 {name:"Medium",icon:"book",url:safe(process.env.REACT_APP_SOCIAL_MEDIUM)},
 {name:"GitHub",icon:"github",url:REPOSITORY_URL},
];
