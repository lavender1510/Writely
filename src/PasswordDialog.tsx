import {useRef,useState} from 'react';
import {useDialogFocus} from './dialog-focus';
export default function PasswordDialog({title,creating=false,changing=false,onSubmit,onClose}:{title:string;creating?:boolean;changing?:boolean;onSubmit:(password:string,next?:string)=>Promise<void>;onClose:()=>void}){
  const ref=useRef<HTMLFormElement>(null);useDialogFocus(ref,()=>{if(!busy)onClose();});
  const [password,setPassword]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="modal-backdrop"><form className="modal" ref={ref} role="dialog" aria-modal="true" aria-labelledby="password-title" onSubmit={async e=>{e.preventDefault();if((creating||changing)&&confirm!==(changing?next:password)){setError('Die Kennwörter stimmen nicht überein.');return;}setBusy(true);setError('');try{await onSubmit(password,changing?next:undefined);setPassword('');setNext('');setConfirm('');onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
    <h2 id="password-title">{title}</h2>
    <p>{creating||changing?'Ohne Kennwort können deine Inhalte nicht wiederhergestellt werden. Es gibt kein Masterkennwort. Verwende mindestens 12 Zeichen.':'Deine Inhalte werden ausschließlich auf diesem Gerät entschlüsselt.'}</p>
    <label className="field-label">{changing?'Bisheriges Kennwort':'Kennwort'}<input className="text-input" autoFocus required minLength={creating?12:1} maxLength={1024} type={visible?'text':'password'} autoComplete={creating?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {changing&&<label className="field-label">Neues Kennwort<input className="text-input" required minLength={12} maxLength={1024} type={visible?'text':'password'} autoComplete="new-password" value={next} onChange={e=>setNext(e.target.value)}/></label>}
    {(creating||changing)&&<label className="field-label">Kennwort bestätigen<input className="text-input" required minLength={12} type={visible?'text':'password'} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}
    <label><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Kennwort anzeigen</label>
    {error&&<p role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>Abbrechen</button><button className="primary-button" disabled={busy}>{busy?'Wird lokal verarbeitet …':changing?'Kennwort ändern':creating?'Schutz aktivieren':'Entsperren'}</button></div>
  </form></div>;
}
