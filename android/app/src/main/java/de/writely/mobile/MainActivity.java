package de.writely.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.view.WindowManager;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state){
        registerPlugin(WritelyFilesPlugin.class);
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE,WindowManager.LayoutParams.FLAG_SECURE);
    }
}
