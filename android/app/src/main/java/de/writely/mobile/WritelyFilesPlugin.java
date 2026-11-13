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
import org.json.JSONArray;

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
    private static final Object BOOK_LOCK=new Object();
    private boolean bookId(String id){return id!=null&&id.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}");}
    private boolean blockId(String id){return "manifest".equals(id)||bookId(id);}
    private File bookFile(String project,String id) throws IOException {
        if(!bookId(project)||!blockId(id))throw new IOException();
        File root=new File(getContext().getNoBackupFilesDir(),"books"),directory=new File(root,project),target=new File(directory,id+".sealed");
        if(!directory.getCanonicalFile().getParentFile().equals(root.getCanonicalFile())||!target.getCanonicalFile().getParentFile().equals(directory.getCanonicalFile()))throw new IOException();
        return target;
    }
    private void validateBook(String text,String project,String id) throws Exception {
        if(text==null||text.length()>24*1024*1024)throw new IOException();JSONObject v=new JSONObject(text);
        if(v.length()!=6||!"WritelyBookBlock".equals(v.optString("format"))||!"1".equals(v.get("version").toString())||!project.equals(v.optString("projectId"))||!id.equals(v.optString("blockId")))throw new IOException();
        if(!v.getString("nonce").matches("[A-Za-z0-9+/]{16}"))throw new IOException();String cipher=v.getString("ciphertext");
        if(cipher.length()<24||cipher.length()%4!=0||cipher.length()>22369644||!cipher.matches("[A-Za-z0-9+/]+={0,2}"))throw new IOException();
    }
    private String readBook(String project,String id) throws Exception {
        File file=bookFile(project,id);try{String text=read(new AtomicFile(file).openRead(),false);validateBook(text,project,id);return text;}catch(FileNotFoundException e){if(file.exists()||new File(file.getPath()+".bak").exists())throw e;return null;}
    }
    private void writeBook(String project,String id,String text) throws Exception {
        File file=bookFile(project,id);if(!file.getParentFile().isDirectory()&&!file.getParentFile().mkdirs())throw new IOException();
        AtomicFile target=new AtomicFile(file);FileOutputStream out=null;
        try{out=target.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));out.getFD().sync();target.finishWrite(out);out=null;}finally{if(out!=null)target.failWrite(out);}
    }
    @PluginMethod public void commitSealed(PluginCall call){synchronized(BOOK_LOCK){
        FileOutputStream out=null;AtomicFile target=file();
        try{String text=call.getString("text"),expected=call.getString("expected"),current=null;validate(text);if(expected!=null)validate(expected);
            try{current=read(target.openRead(),false);validate(current);}catch(FileNotFoundException e){if(target.getBaseFile().exists()||new File(target.getBaseFile().getPath()+".bak").exists())throw e;}
            String normalized=current==null?null:new JSONObject(current).toString(),wanted=expected==null?null:new JSONObject(expected).toString();
            if(!java.util.Objects.equals(normalized,wanted)){call.reject("Der Tresor wurde zwischenzeitlich geändert. Entsperre ihn erneut.");return;}
            out=target.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));out.getFD().sync();target.finishWrite(out);out=null;call.resolve();
        }catch(Exception e){if(out!=null)target.failWrite(out);call.reject("Der Tresor konnte nicht gespeichert werden. Der letzte Stand bleibt erhalten.");}
    }}
    @PluginMethod public void readBookBlock(PluginCall call){synchronized(BOOK_LOCK){try{String text=readBook(call.getString("projectId"),call.getString("blockId"));call.resolve(new JSObject().put("text",text==null?JSONObject.NULL:text));}catch(Exception e){call.reject("Der verschlüsselte Buchblock konnte nicht gelesen werden.");}}}
    @PluginMethod public void writeBookBlock(PluginCall call){synchronized(BOOK_LOCK){try{String p=call.getString("projectId"),id=call.getString("blockId"),text=call.getString("text");File file=bookFile(p,id);validateBook(text,p,id);if("manifest".equals(id)||file.exists()||new File(file.getPath()+".bak").exists())throw new IOException();writeBook(p,id,text);call.resolve();}catch(Exception e){call.reject("Der neue Buchblock konnte nicht gespeichert werden. Prüfe den freien Speicherplatz.");}}}
    @PluginMethod public void commitBookManifest(PluginCall call){synchronized(BOOK_LOCK){try{String p=call.getString("projectId"),text=call.getString("text"),expected=call.getString("expected");bookFile(p,"manifest");validateBook(text,p,"manifest");String old=readBook(p,"manifest");if(!java.util.Objects.equals(old,expected)){call.reject("Das Buch wurde zwischenzeitlich geändert. Öffne es erneut, bevor du speicherst.");return;}JSONArray required=call.getArray("required");if(required!=null){if(required.length()>30001)throw new IOException();String[] names=bookFile(p,"manifest").getParentFile().list();java.util.Set<String> existing=new java.util.HashSet<>();if(names!=null)java.util.Collections.addAll(existing,names);for(int i=0;i<required.length();i++){String id=required.getString(i);if(!bookId(id)||!existing.contains(id+".sealed")){call.reject("Ein benötigter Buchblock fehlt. Der vorherige Stand bleibt erhalten.");return;}}}writeBook(p,"manifest",text);call.resolve();}catch(Exception e){call.reject("Das Buchmanifest konnte nicht gespeichert werden. Der letzte Stand bleibt erhalten.");}}}
    @PluginMethod public void collectBookBlocks(PluginCall call){synchronized(BOOK_LOCK){try{String p=call.getString("projectId"),expected=call.getString("expected");bookFile(p,"manifest");JSONArray keep=call.getArray("keep");Double cutoff=call.getDouble("cutoff");if(keep==null||keep.length()>30001||cutoff==null||cutoff.isNaN()||cutoff.isInfinite())throw new IOException();java.util.Set<String> used=new java.util.HashSet<>();used.add("manifest");for(int i=0;i<keep.length();i++){String id=keep.getString(i);if(!bookId(id))throw new IOException();used.add(id);}int removed=0;if(java.util.Objects.equals(readBook(p,"manifest"),expected)){File[] files=bookFile(p,"manifest").getParentFile().listFiles();if(files!=null)for(File file:files){String name=file.getName();if(!name.endsWith(".sealed"))continue;String id=name.substring(0,name.length()-7);if(bookId(id)&&!used.contains(id)&&file.lastModified()<cutoff&&removed<200){if(!file.delete())throw new IOException();removed++;}}}call.resolve(new JSObject().put("removed",removed));}catch(Exception e){call.reject("Unbenutzte Buchblöcke konnten nicht bereinigt werden. Aktuelle Texte bleiben erhalten.");}}}
    @PluginMethod public void listBookBlocks(PluginCall call){synchronized(BOOK_LOCK){try{String p=call.getString("projectId");File directory=bookFile(p,"manifest").getParentFile();File[] files=directory.listFiles();JSONArray items=new JSONArray();if(files!=null)for(File file:files){String name=file.getName();if(!name.endsWith(".sealed"))continue;String id=name.substring(0,name.length()-7);if(blockId(id))items.put(new JSObject().put("id",id).put("modifiedAt",file.lastModified()));}call.resolve(new JSObject().put("items",items));}catch(Exception e){call.reject("Die Buchblock-Liste konnte nicht gelesen werden.");}}}
    @PluginMethod public void listBookProjects(PluginCall call){synchronized(BOOK_LOCK){try{File root=new File(getContext().getNoBackupFilesDir(),"books");File[] directories=root.listFiles();JSONArray items=new JSONArray();if(directories!=null)for(File dir:directories)if(bookId(dir.getName())&&dir.isDirectory()){bookFile(dir.getName(),"manifest");items.put(new JSObject().put("id",dir.getName()).put("modifiedAt",dir.lastModified()));}call.resolve(new JSObject().put("items",items));}catch(Exception e){call.reject("Die Buchspeicher-Liste konnte nicht gelesen werden.");}}}
    @PluginMethod public void removeBookProject(PluginCall call){synchronized(BOOK_LOCK){try{String project=call.getString("projectId");File directory=bookFile(project,"manifest").getParentFile();if(!directory.exists()){call.resolve();return;}File[] files=directory.listFiles();if(files==null)throw new IOException();for(File file:files){String id=file.getName().replaceFirst("\\.sealed(?:\\.bak|\\.new)?$","");if(!blockId(id)||file.isDirectory())throw new IOException();}for(File file:files)if(!file.delete())throw new IOException();if(!directory.delete())throw new IOException();call.resolve();}catch(Exception e){call.reject("Der unbenutzte Buchspeicher konnte nicht entfernt werden.");}}}
    @PluginMethod public void removeBookBlock(PluginCall call){synchronized(BOOK_LOCK){try{File file=bookFile(call.getString("projectId"),call.getString("blockId"));if(file.exists()&&!file.delete())throw new IOException();call.resolve();}catch(Exception e){call.reject("Der Buchblock konnte nicht entfernt werden.");}}}
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
