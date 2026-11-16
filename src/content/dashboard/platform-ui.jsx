import React,{useLayoutEffect,useRef,useState} from 'react';
import {Icon} from './visuals.jsx';

export function GlassTabs({items,value,onChange,label,vertical=false,className=''}){
 const ref=useRef(null),[pill,setPill]=useState(null);
 const signature=items.map(x=>x.id+':'+x.label).join('|');
 useLayoutEffect(()=>{
  const measure=()=>{const root=ref.current,button=root?.querySelector('[aria-selected="true"]');if(!root||!button)return;setPill({x:button.offsetLeft,y:button.offsetTop,width:button.offsetWidth,height:button.offsetHeight});};
  measure();const observer=new ResizeObserver(measure);if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();
 },[value,signature]);
 const onKeyDown=e=>{const keys=vertical?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight'];if(![...keys,'Home','End'].includes(e.key))return;e.preventDefault();const current=items.findIndex(x=>x.id===value),next=e.key==='Home'?0:e.key==='End'?items.length-1:(current+(e.key===keys[0]?-1:1)+items.length)%items.length;onChange(items[next].id);ref.current?.querySelectorAll('[role="tab"]')[next]?.focus();};
 return <div ref={ref} className={`pf-glass-tabs ${vertical?'vertical':''} ${className}`} role="tablist" aria-label={label} aria-orientation={vertical?'vertical':'horizontal'} onKeyDown={onKeyDown}>
  <span className="pf-glass-pill" aria-hidden="true" style={pill?{width:pill.width,height:pill.height,transform:`translate3d(${pill.x}px,${pill.y}px,0)`}:{opacity:0}}/>
  {items.map(item=><button key={item.id} role="tab" aria-label={item.label} aria-selected={value===item.id} tabIndex={value===item.id?0:-1} title={item.label} className={value===item.id?'selected':''} onClick={()=>onChange(item.id)}>{item.icon&&<Icon name={item.icon}/>}<span>{item.label}</span>{item.badge>0&&<b>{item.badge}</b>}</button>)}
 </div>;
}

export function PlatformHeading({number,title,children}){return <div className="pf-section-heading"><div>{number&&<span>{number}</span>}<h2>{title}</h2></div>{children}</div>;}
