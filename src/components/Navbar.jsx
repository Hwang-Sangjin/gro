'use client';
import Link from 'next/link';
import {useIntro} from './intro/intro-context';
import {useCrate} from './crate/CrateProvider';
import {NAV} from './crate/routes';
import DoodleSprite from './doodle/DoodleSprite';

// Each page owns its header and active menu, including its outgoing frozen layer.
export default function Navbar({path}){
  const {done}=useIntro(),{sound,toggleSound}=useCrate();
  return <nav className="navbar ct-navbar" data-home={path==='/'?'true':'false'} data-ready={done?'true':'false'} aria-label="주 메뉴">
    <Link className="navbar-mark" href="/">Grooves</Link>
    <div className="ct-nav-menu">
      {NAV.map(item=><Link key={item.href} href={item.href} aria-label={item.label}
        aria-current={path===item.href?'page':undefined} className="ct-nav-link">
        <DoodleSprite id={item.doodle}/><span>{item.label}</span>
      </Link>)}
    </div>
    <div className="ct-nav-actions"><Link href="/login">Login</Link><button type="button" onClick={toggleSound} aria-pressed={sound} aria-label="페이지 전환 효과음">{sound?'Sound on':'Sound off'}</button></div>
  </nav>;
}
