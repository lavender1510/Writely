package de.writely.mobile;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.view.WindowManager;
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
            js(scenario,"document.querySelector('.secure-card-open').click()");
            until(scenario,"!!document.querySelector('.secure-prose table')&&!!document.querySelector('.secure-prose img')");
            js(scenario,"(()=>{const e=document.querySelector('.secure-prose');e.focus();const s=getSelection();s.selectAllChildren(e.firstChild);s.collapseToEnd();return true})()");
            InstrumentationRegistry.getInstrumentation().sendStringSync(" Android");
            until(scenario,"document.querySelector('.secure-prose').textContent.includes('Android')");
            until(scenario,"[...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('Verschlüsselt gespeichert'))");
            js(scenario,"document.querySelector('[aria-label=\"Jetzt sperren\"]').click()");
            until(scenario,"!document.querySelector('.secure-prose')&&!document.body.textContent.includes('Windows ↔ Android')");
            assertFalse(new String(java.nio.file.Files.readAllBytes(target.toPath()),StandardCharsets.UTF_8).contains("Windows ↔ Android"));
        }
    }
}
