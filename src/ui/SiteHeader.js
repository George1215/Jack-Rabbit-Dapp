import React,{useEffect,useState} from "react";
import {Link,NavLink,useLocation} from "react-router-dom";
import Icon from "./Icon";
import {IS_UI_PREVIEW,useUi} from "./UiContext";
import WalletButton from "../components/WalletButton";
import logo from "../assets/jacklogo.png";
const tabs=[['/stake','Stake'],['/farms','Farms'],['/mining','Mining'],['/nfts','Bond NFTs'],['/treasury','Treasury']];
export default function SiteHeader(){
 const {pathname,hash}=useLocation();const [open,setOpen]=useState(false);const {previewAction}=useUi();const landing=pathname==='/';
 useEffect(()=>{setOpen(false);if(hash){const id=decodeURIComponent(hash.slice(1));const timer=setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}),350);return()=>clearTimeout(timer);}},[pathname,hash]);
 return <><a className="jr-skip" href="#main-content">Skip to content</a><header id="top" className="jr-header"><div className="jr-container jr-header-inner">
 <Link to="/" className="jr-brand" aria-label="Jack Rabbit home"><img src={logo} alt=""/><span>JACK<span>RABBIT</span></span></Link>
 <nav className="jr-desktop-nav" aria-label="Main navigation">{landing?<><a href="#ecosystem">Ecosystem</a><a href="#how-it-works">Our mission</a><a href="#roadmap">Roadmap</a><a href="#community">Community</a></>:tabs.map(([to,name])=><NavLink key={to} to={to} className={pathname==='/jackies'&&to==='/stake'?'active':undefined}>{name}</NavLink>)}</nav>
 <div className="jr-header-actions">{landing?<Link className="jr-btn jr-btn-dark jr-btn-small" to="/stake">Launch dApp <Icon size={16}/></Link>:IS_UI_PREVIEW?<button className="jr-btn jr-btn-dark jr-btn-small" onClick={()=>previewAction('Connect wallet')}><Icon name="wallet" size={17}/><span>Connect wallet</span></button>:<WalletButton className="jr-btn jr-btn-dark jr-btn-small"/>}
 <button className="jr-menu-btn jr-icon-btn" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="jr-mobile-nav" aria-label={open?'Close navigation':'Open navigation'}><Icon name={open?'close':'menu'}/></button></div></div>
 {open&&<nav id="jr-mobile-nav" className="jr-mobile-nav" aria-label="Mobile navigation">{tabs.map(([to,label])=><NavLink key={to} to={to}>{label}<Icon size={17}/></NavLink>)}<Link to="/#community">Community <Icon size={17}/></Link><Link to="/">Home <Icon size={17}/></Link></nav>}</header></>;
}
export function SectionTabs(){
 const {pathname}=useLocation();let items=[];
 if(pathname.startsWith('/stake')||pathname.startsWith('/jackies'))items=[['/stake','External stakers'],['/jackies','JACK stakers']];
 else if(pathname.startsWith('/mining'))items=[['/mining','Mining hub'],['/mining/claims','Your miners & claims']];
 else if(pathname.startsWith('/nfts'))items=[['/nfts','Mint a bond'],['/nfts/bonds','My bond positions']];
 else if(pathname.startsWith('/treasury'))items=[['/treasury','Overview'],['/treasury/burn','Burn engine'],['/treasury/vault','Vault'],['/treasury/activity','Activity']];
 if(!items.length)return null;
 return <div className="jr-subnav"><nav className="jr-container" aria-label="Section navigation">{items.map(([to,label])=><NavLink end key={to} to={to} className={pathname==='/stake/jackies'&&to==='/jackies'?'active':undefined}>{label}</NavLink>)}<span className="jr-subnav-note"><Icon name="shield" size={14}/> {IS_UI_PREVIEW?'Design preview':'PulseChain ecosystem'}</span></nav></div>;
}
