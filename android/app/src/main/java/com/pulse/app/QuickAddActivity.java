package com.pulse.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class QuickAddActivity extends Activity {

    private static final String TAG = "QuickAddActivity";
    private static final int REQ_CODE_SPEECH_INPUT = 100;

    private EditText taskInput;
    private ImageButton micBtn;
    private Button sendBtn;

    private String supabaseUrl;
    private String supabaseKey;
    private String accessToken;
    private String userId;

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quick_add);

        // Make activity transparent/floating if needed by theme, but layout handles internal look.
        // Ensure keyboard shows up logic?
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE);
        
        // Position window at the top (Top 1/3 roughly) to avoid keyboard overlap
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.gravity = android.view.Gravity.TOP;
        params.y = 200; // Offset from top in pixels (adjust as needed, approx top 1/3 area)
        params.width = WindowManager.LayoutParams.MATCH_PARENT;
        // Horizontal margin usually handled by dialog theme padding, but we can override:
        // params.horizontalMargin = 0.05f; 
        getWindow().setAttributes(params);

        taskInput = findViewById(R.id.taskInput);
        micBtn = findViewById(R.id.micBtn);
        sendBtn = findViewById(R.id.sendBtn);

        // Ensure focus and keyboard
        taskInput.requestFocus();

        micBtn.setOnClickListener(v -> promptSpeechInput());
        
        if (getIntent().getBooleanExtra("AUTO_VOICE", false)) {
            promptSpeechInput();
        }
        sendBtn.setOnClickListener(v -> sendTask());

        loadCredentials();
    }

    private void loadCredentials() {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        supabaseUrl = prefs.getString("supabase_url", null);
        supabaseKey = prefs.getString("supabase_key", null);
        accessToken = prefs.getString("access_token", null);
        userId = prefs.getString("user_id", null);

        Log.d(TAG, "Credentials loaded. URL: " + (supabaseUrl != null) + ", User: " + (userId != null));
        
        if (supabaseUrl == null || accessToken == null) {
            Toast.makeText(this, "Please open the main app to sync login", Toast.LENGTH_LONG).show();
        }
    }

    private void promptSpeechInput() {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Say the task name");
        try {
            startActivityForResult(intent, REQ_CODE_SPEECH_INPUT);
        } catch (Exception e) {
            Toast.makeText(this, "Speech input not supported", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_CODE_SPEECH_INPUT && resultCode == RESULT_OK && data != null) {
            ArrayList<String> result = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (result != null && !result.isEmpty()) {
                String spokenText = result.get(0);
                String currentText = taskInput.getText().toString();
                if (!currentText.isEmpty()) {
                    taskInput.setText(currentText + " " + spokenText);
                } else {
                    taskInput.setText(spokenText);
                }
                taskInput.setSelection(taskInput.getText().length());
            }
        }
    }

    private void sendTask() {
        String title = taskInput.getText().toString().trim();
        if (title.isEmpty()) {
            Toast.makeText(this, "Enter a task name", Toast.LENGTH_SHORT).show();
            return;
        }

        if (supabaseUrl == null || accessToken == null || userId == null) {
            Toast.makeText(this, "Credentials missing. Open App.", Toast.LENGTH_LONG).show();
            return;
        }

        sendBtn.setEnabled(false);
        
        try {
            JSONObject json = new JSONObject();
            json.put("title", title);
            json.put("user_id", userId);
            
            SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            isoFormat.setTimeZone(TimeZone.getTimeZone("UTC"));
            json.put("created_at", isoFormat.format(new Date()));
            
            // Assuming 'date' field might be needed or 'status', but standard table usually defaults. 
            // Based on user request: payload { title, user_id, created_at }

            RequestBody body = RequestBody.create(json.toString(), MediaType.get("application/json; charset=utf-8"));
            
            // Construct URL: [supabase_url]/rest/v1/tasks
            String url = supabaseUrl + "/rest/v1/tasks";
            
            Request request = new Request.Builder()
                    .url(url)
                    .addHeader("apikey", supabaseKey)
                    .addHeader("Authorization", "Bearer " + accessToken)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Prefer", "return=minimal")
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    runOnUiThread(() -> {
                        Toast.makeText(QuickAddActivity.this, "Network Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        sendBtn.setEnabled(true);
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    if (response.isSuccessful()) {
                        runOnUiThread(() -> {
                            Toast.makeText(QuickAddActivity.this, "Task Saved!", Toast.LENGTH_SHORT).show();
                            taskInput.setText("");
                            finish();
                        });
                    } else {
                        String err = response.body() != null ? response.body().string() : "Unknown error";
                        runOnUiThread(() -> {
                            Toast.makeText(QuickAddActivity.this, "Error: " + response.code(), Toast.LENGTH_LONG).show();
                            Log.e(TAG, "Error posting task: " + err);
                            sendBtn.setEnabled(true);
                        });
                    }
                }
            });

        } catch (Exception e) {
             Toast.makeText(this, "JSON Error", Toast.LENGTH_SHORT).show();
             sendBtn.setEnabled(true);
             Log.e(TAG, "JSON Exception", e);
        }
    }
}
