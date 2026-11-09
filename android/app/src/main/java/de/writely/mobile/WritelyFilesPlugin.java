package de.writely.mobile;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.AtomicFile;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** SAF grants access only to the file explicitly selected by the user. */
@CapacitorPlugin(name="WritelyFiles")
public class WritelyFilesPlugin extends Plugin {
    private static final int LIMIT=90*1024*1024;
    private AtomicFile file(){return new AtomicFile(new File(getContext().getNoBackupFilesDir(),"workspace.sealed"));}
    private String read(InputStream input,boolean binary) throws IOException {
        if(input==null)throw new IOException();
        try(InputStream in=input;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[16384];int n;
            while((n=in.read(buffer))!=-1){if(out.size()+n>LIMIT)throw new IOException("Datei zu groß");out.write(buffer,0,n);}
            return binary?android.util.Base64.encodeToString(out.toByteArray(),android.util.Base64.NO_WRAP):out.toString(StandardCharsets.UTF_8.name());
        }
    }
    private void validate(String text) throws Exception {
        if(text==null||text.length()>LIMIT)throw new IOException();
        JSONObject v=new JSONObject(text);
        if(v.length()!=9||!"WritelySealed".equals(v.optString("format"))||v.optInt("version")!=1||!v.optString("id").matches("[a-f0-9-]{36}"))throw new IOException();
        JSONObject k=v.getJSONObject("kdf");
        if(k.length()!=5||!"argon2id".equals(k.optString("name"))||k.optInt("version")!=19||k.optInt("memoryKiB")!=65536||k.optInt("iterations")!=3||k.optInt("parallelism")!=1)throw new IOException();
        for(String field:new String[]{"salt","wrapNonce","wrappedKey","nonce"}){
            int size=field.equals("salt")?32:field.equals("wrappedKey")?48:12;
            String value=v.getString(field);
            if(value.length()!=((size+2)/3)*4||!value.matches("[A-Za-z0-9+/]*={0,2}")||android.util.Base64.decode(value,android.util.Base64.NO_WRAP).length!=size)throw new IOException();
        }
        String encrypted=v.getString("ciphertext");
        if(encrypted.length()<24||encrypted.length()%4!=0||encrypted.length()>89478508||!encrypted.matches("[A-Za-z0-9+/]+={0,2}"))throw new IOException();
    }
    @PluginMethod public void readSealed(PluginCall call){
        try{JSObject result=new JSObject();String text;
            try{text=read(file().openRead(),false);}catch(FileNotFoundException e){result.put("text",JSONObject.NULL);call.resolve(result);return;}
            validate(text);result.put("text",text);call.resolve(result);
        }catch(Exception e){call.reject("Der verschlüsselte Tresor konnte nicht gelesen werden.");}
    }
    @PluginMethod public synchronized void writeSealed(PluginCall call){
        FileOutputStream out=null;AtomicFile target=file();
        try{String text=call.getString("text");validate(text);out=target.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));target.finishWrite(out);out=null;call.resolve();}
        catch(Exception e){if(out!=null)target.failWrite(out);call.reject("Der Tresor konnte nicht gespeichert werden. Prüfe den freien Speicherplatz.");}
    }
    @PluginMethod public void openFile(PluginCall call){
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(call,intent,"opened");
    }
    @ActivityCallback private void opened(PluginCall call,ActivityResult result){
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.resolve(new JSObject().put("cancelled",true));return;}
        try{Uri uri=result.getData().getData();String name="Dokument.writely";
            try(Cursor cursor=getContext().getContentResolver().query(uri,null,null,null,null)){
                if(cursor!=null&&cursor.moveToFirst()){int column=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);if(column>=0)name=cursor.getString(column);}
            }
            boolean binary=name.toLowerCase(java.util.Locale.ROOT).matches(".*\\.(docx|odt)$");
            call.resolve(new JSObject().put("name",name).put(binary?"base64":"text",read(getContext().getContentResolver().openInputStream(uri),binary)));
        }catch(Exception e){call.reject("Die ausgewählte Datei konnte nicht geöffnet werden.");}
    }
    @PluginMethod public void saveFile(PluginCall call){
        String text=call.getString("text"),name=call.getString("name"),mime=call.getString("mime");
        if(text==null||text.length()>LIMIT||name==null||name.length()>150||name.contains("/")||name.contains("\\")||mime==null){call.reject("Die Exportangaben sind ungültig.");return;}
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,name);
        startActivityForResult(call,intent,"saved");
    }
    @ActivityCallback private void saved(PluginCall call,ActivityResult result){
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.resolve(new JSObject().put("cancelled",true));return;}
        try(OutputStream out=getContext().getContentResolver().openOutputStream(result.getData().getData(),"wt")){
            if(out==null)throw new IOException();out.write(Boolean.TRUE.equals(call.getBoolean("base64"))?android.util.Base64.decode(call.getString("text"),android.util.Base64.NO_WRAP):call.getString("text").getBytes(StandardCharsets.UTF_8));call.resolve(new JSObject().put("cancelled",false));
        }catch(Exception e){call.reject("Die Exportdatei konnte nicht geschrieben werden.");}
    }
}
