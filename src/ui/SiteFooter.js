import React from "react";
import {Link} from "react-router-dom";
import Icon from "./Icon";
import {useUi} from "./UiContext";
import {SOCIALS,REPOSITORY_URL} from "./community";
import logo from "../assets/jacklogo.png";
export function SocialLinks({large=false}){
 const {show}=useUi();
 const explain=s=>show({title:`${s.name}, without the guesswork.`,eyebrow:"OFFICIAL COMMUNITY LINKS",body:<p>The official Jack Rabbit {s.name} link has not been confirmed yet. We will never direct you to an unverified account. Explore the confirmed GitHub repository in the meantime.</p>,actions:<a className="jr-btn jr-btn-dark" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">Open GitHub <Icon name="external"/></a>});
 return <div className={`jr-socials ${large?'jr-socials-large':''}`}>{SOCIALS.map(s=>s.url?
 <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Jack Rabbit on ${s.name}`}><Icon name={s.icon}/>{large&&<span>{s.name}<Icon name="external" size={14}/></span>}</a>:
 <button key={s.name} type="button" className="jr-social-pending" aria-label={`${s.name}: official link pending`} onClick={()=>explain(s)}><Icon name={s.icon}/>{large&&<span>{s.name}<small>Link pending</small></span>}</button>)}</div>;
}
export default function SiteFooter(){
 const {show}=useUi();
 const risk=()=>show({eyebrow:"BEFORE YOU PARTICIPATE",title:"Understand the risks.",body:<><p>Smart contracts, tokens, and liquidity positions involve risk. Rewards, token values, and the pDAI peg are not guaranteed.</p><p>Verify the network and contract addresses before signing. This interface is under development; a design preview is not a security audit or a production launch.</p></>});
 return <footer className="jr-footer"><div className="jr-container jr-footer-grid">
 <div className="jr-footer-brand"><Link to="/" className="jr-brand"><img src={logo} alt=""/><span>JACK<span>RABBIT</span></span></Link><p>A community-powered ecosystem designed to build participation, strengthen reserves, and support the pDAI mission.</p><SocialLinks/></div>
 <div><h3>Explore the burrow</h3><Link to="/stake">External staking</Link><Link to="/jackies">JACK staking</Link><Link to="/farms">Liquidity farms</Link><Link to="/mining">Mining hub</Link><Link to="/nfts">Bond NFTs</Link><Link to="/treasury">Treasury</Link></div>
 <div><h3>Keep exploring</h3><Link to="/#how-it-works">How JACK works</Link><Link to="/#roadmap">The roadmap</Link><Link to="/#faq">Questions & answers</Link><Link to="/#community">Community</Link><a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">Source code <Icon name="external" size={13}/></a><button onClick={risk}>Risk information <Icon name="info" size={13}/></button></div>
 <div className="jr-footer-note"><span className="jr-eyebrow">STAY CURIOUS. STAY CAREFUL.</span><h3>One rabbit.<br/>A whole ecosystem.</h3><p>Community accounts will be linked only after their official destinations are confirmed.</p><a className="jr-footer-top" href="#top">Back to top ↑</a></div>
 </div><div className="jr-container jr-footer-bottom"><span>© {new Date().getFullYear()} Jack Rabbit.</span><span>Built on PulseChain. Designed for the community.</span><span>pDAI support is a mission, not a guarantee.</span></div></footer>;
}
