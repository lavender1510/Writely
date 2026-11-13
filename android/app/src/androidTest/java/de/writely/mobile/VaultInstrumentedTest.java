package de.writely.mobile;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.view.WindowManager;
import android.view.MotionEvent;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONArray;

@RunWith(AndroidJUnit4.class)
public class VaultInstrumentedTest {
    private String js(ActivityScenario<MainActivity> scenario,String code) throws Exception {
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(activity->activity.getBridge().getWebView().evaluateJavascript(code,value->{result.set(value);done.countDown();}));
        assertTrue("WebView antwortet",done.await(15,TimeUnit.SECONDS));return result.get();
    }
    private void until(ActivityScenario<MainActivity> scenario,String code) throws Exception {
        long end=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<end){if("true".equals(js(scenario,code)))return;Thread.sleep(150);}
        fail("WebView-Bedingung nicht erfüllt: "+code);
    }
    @Test public void realWebViewUnlockEditSaveLockAndOfflineSecurity() throws Exception {
        Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("de.writely.mobile",app.getPackageName());
        assertEquals(0,app.getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertEquals(PackageManager.PERMISSION_DENIED,app.checkSelfPermission("android.permission.INTERNET"));
        byte[] fixture;
        try(InputStream in=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("sealed-v1.writely")){fixture=in.readAllBytes();}
        File target=new File(app.getNoBackupFilesDir(),"workspace.sealed");
        try(FileOutputStream out=new FileOutputStream(target)){out.write(fixture);out.getFD().sync();}
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            scenario.onActivity(activity->assertTrue((activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE)!=0));
            until(scenario,"[...document.querySelectorAll('button')].some(b=>b.textContent==='Tresor entsperren'&&!b.disabled)");
            js(scenario,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Tresor entsperren').click()");
            until(scenario,"!!document.querySelector('input[type=password]')");
            js(scenario,"(()=>{const i=document.querySelector('input[type=password]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Writely Testvektor Grüße 2026');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
            js(scenario,"document.querySelector('form').requestSubmit()");
            until(scenario,"document.body.textContent.includes('Windows ↔ Android')");
            // Create a real document in the currently opened folder before the legacy roundtrip.
            js(scenario,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Ordner').click()");
            until(scenario,"!!document.querySelector('[aria-label=Ordnername]')");
            js(scenario,"(()=>{const i=document.querySelector('[aria-label=Ordnername]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Android-Ordner');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
            js(scenario,"document.querySelector('.folder-dialog').requestSubmit()");
            until(scenario,"!document.querySelector('.folder-dialog')&&!!document.querySelector('.folder-cards button')");
            js(scenario,"document.querySelector('.folder-cards button').click()");
            until(scenario,"document.querySelector('[aria-label=\"Neue Inhalte in\"]').value!==''");
            js(scenario,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Neues Dokument').click()");
            until(scenario,"!!document.querySelector('.secure-prose')");
            js(scenario,"(()=>{const i=document.querySelector('[aria-label=Dokumenttitel]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Android-Ordnerdokument');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
            js(scenario,"document.querySelector('[aria-label=\"Zur Bibliothek\"]').click()");
            until(scenario,"!!document.querySelector('.secure-card-open')&&document.querySelector('.secure-card-open').textContent.includes('Android-Ordnerdokument')");
            js(scenario,"document.querySelector('.folder-breadcrumbs button').click()");
            until(scenario,"document.querySelector('.secure-card-open').textContent.includes('Windows ↔ Android')");
            js(scenario,"document.querySelector('.secure-card-open').click()");
            until(scenario,"!!document.querySelector('.secure-prose table')&&!!document.querySelector('.secure-prose img')");
            assertEquals("true",js(scenario,"(()=>{const t=document.querySelector('.secure-tools');return t.scrollWidth>t.clientWidth&&document.documentElement.scrollWidth<=innerWidth})()"));
            js(scenario,"document.querySelector('[aria-label=\"Lesemodus\"]').click()");
            until(scenario,"document.querySelector('.secure-prose').contentEditable==='false'&&getComputedStyle(document.querySelector('.secure-tools')).display==='none'");
            js(scenario,"document.querySelector('[aria-label=\"Lesemodus\"]').click()");
            until(scenario,"document.querySelector('.secure-prose').contentEditable==='true'");
            // A real touch establishes Android's input connection. Programmatic
            // DOM focus alone can race WebView/IME startup and lose key events.
            JSONArray point=new JSONArray(js(scenario,"(()=>{const e=document.querySelector('.secure-prose > p');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,innerWidth]})()"));
            AtomicReference<float[]> tap=new AtomicReference<>();
            scenario.onActivity(activity->{WebView view=activity.getBridge().getWebView();view.requestFocus();int[] location=new int[2];view.getLocationOnScreen(location);float scale=(float)(view.getWidth()/point.optDouble(2));tap.set(new float[]{location[0]+(float)point.optDouble(0)*scale,location[1]+(float)point.optDouble(1)*scale});});
            long time=SystemClock.uptimeMillis();float[] position=tap.get();
            InstrumentationRegistry.getInstrumentation().sendPointerSync(MotionEvent.obtain(time,time,MotionEvent.ACTION_DOWN,position[0],position[1],0));
            InstrumentationRegistry.getInstrumentation().sendPointerSync(MotionEvent.obtain(time,time+80,MotionEvent.ACTION_UP,position[0],position[1],0));
            until(scenario,"document.activeElement===document.querySelector('.secure-prose')&&document.hasFocus()");
            js(scenario,"(()=>{const e=document.querySelector('.secure-prose');const s=getSelection();s.selectAllChildren(e.firstChild);s.collapseToEnd();return true})()");
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            InstrumentationRegistry.getInstrumentation().sendStringSync(" Android");
            until(scenario,"document.querySelector('.secure-prose').textContent.includes('Android')");
            until(scenario,"[...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('Verschlüsselt gespeichert'))");
            js(scenario,"document.querySelector('[aria-label=\"Erweiterte Werkzeuge\"]').click()");
            js(scenario,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Layout').click()");
            js(scenario,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Seite einrichten').click()");
            until(scenario,"!!document.querySelector('[aria-label=Papierformat]')");
            js(scenario,"(()=>{const e=document.querySelector('[aria-label=Papierformat]');e.value='A5';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
            js(scenario,"[...document.querySelectorAll('button')].find(b=>b.textContent==='Layout anwenden').click()");
            until(scenario,"[...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('Verschlüsselt gespeichert'))");
            js(scenario,"document.querySelector('[aria-label=\"Dokumentaktionen\"]').click()");
            until(scenario,"!!document.querySelector('[aria-label=\"Jetzt sperren\"]')");
            js(scenario,"document.querySelector('[aria-label=\"Jetzt sperren\"]').click()");
            until(scenario,"!document.querySelector('.secure-prose')&&!document.body.textContent.includes('Windows ↔ Android')");
            assertFalse(new String(java.nio.file.Files.readAllBytes(target.toPath()),StandardCharsets.UTF_8).contains("Windows ↔ Android"));
        }
    }
}
