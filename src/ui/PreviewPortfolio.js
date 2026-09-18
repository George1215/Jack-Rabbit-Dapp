import React,{createContext,useContext,useState} from "react";
import {INITIAL_BONDS} from "../pages/Bond";
const Portfolio=createContext(null);
export function PreviewPortfolioProvider({children}){
 const [bonds,setBonds]=useState(()=>INITIAL_BONDS.map(b=>({...b,example:true})));
 function addBond(data){const id=`UI-${Date.now().toString().slice(-7)}`;setBonds(rows=>[{...data,id,status:'Active',example:true},...rows]);return id;}
 function updateBond(id,changes){setBonds(rows=>rows.map(b=>b.id===id?{...b,...changes}:b));}
 return <Portfolio.Provider value={{bonds,addBond,updateBond}}>{children}</Portfolio.Provider>;
}
export function usePreviewPortfolio(){return useContext(Portfolio);}
export function displayAmount(value){return Number(value||0).toLocaleString(undefined,{maximumFractionDigits:2});}
export function localIso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function dateAfter(days){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+days);return localIso(d);}
