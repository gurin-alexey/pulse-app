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
    private android.os.CountDownTimer autoSendTimer;

    private String supabaseUrl;
    private String supabaseKey;
    private String accessToken;
    private String refreshToken;
    private String userId;
    private boolean isRefreshing = false;

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

        // Cancel auto-send timer if user edits text manually
        taskInput.addTextChangedListener(new android.text.TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                if (autoSendTimer != null) {
                    autoSendTimer.cancel();
                    autoSendTimer = null;
                    sendBtn.setText("Send");
                }
            }

            @Override
            public void afterTextChanged(android.text.Editable s) {}
        });

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
        refreshToken = prefs.getString("refresh_token", null);
        userId = prefs.getString("user_id", null);

        Log.d(TAG, "Credentials loaded. URL: " + (supabaseUrl != null) + ", User: " + (userId != null) + ", HasRefreshToken: " + (refreshToken != null));
        
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
                    if (spokenText.length() > 0) {
                        spokenText = spokenText.substring(0, 1).toUpperCase() + spokenText.substring(1);
                    }
                    taskInput.setText(spokenText);
                }
                taskInput.setSelection(taskInput.getText().length());
                startAutoSendTimer();
            }
        }
    }

    private void startAutoSendTimer() {
        if (autoSendTimer != null) autoSendTimer.cancel();
        
        autoSendTimer = new android.os.CountDownTimer(2500, 1000) {
            public void onTick(long millisUntilFinished) {
                if (sendBtn != null) {
                    sendBtn.setText("Send (" + (millisUntilFinished / 1000 + 1) + ")");
                }
            }

            public void onFinish() {
                if (sendBtn != null) {
                    sendBtn.setText("Sending...");
                    sendTask();
                }
            }
        }.start();
    }

    private void sendTask() {
        sendTaskWithRetry(false);
    }

    private void sendTaskWithRetry(boolean isRetry) {
        // Cancel timer if manually triggered
        if (autoSendTimer != null) {
            autoSendTimer.cancel();
            autoSendTimer = null;
        }
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
                    } else if ((response.code() == 401 || response.code() == 403) && !isRetry && refreshToken != null) {
                        // Token expired, try to refresh
                        Log.d(TAG, "Token expired (code " + response.code() + "), attempting refresh...");
                        response.close();
                        refreshAccessToken(() -> sendTaskWithRetry(true));
                    } else {
                        String err = response.body() != null ? response.body().string() : "Unknown error";
                        runOnUiThread(() -> {
                            if (response.code() == 401 || response.code() == 403) {
                                Toast.makeText(QuickAddActivity.this, "Access denied. Please open the app.", Toast.LENGTH_LONG).show();
                            } else {
                                Toast.makeText(QuickAddActivity.this, "Error: " + response.code(), Toast.LENGTH_LONG).show();
                            }
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

    private void refreshAccessToken(Runnable onSuccess) {
        if (isRefreshing) return;
        isRefreshing = true;

        try {
            JSONObject json = new JSONObject();
            json.put("refresh_token", refreshToken);

            RequestBody body = RequestBody.create(json.toString(), MediaType.get("application/json; charset=utf-8"));
            String url = supabaseUrl + "/auth/v1/token?grant_type=refresh_token";

            Request request = new Request.Builder()
                    .url(url)
                    .addHeader("apikey", supabaseKey)
                    .addHeader("Content-Type", "application/json")
                    .post(body)
                    .build();

            client.newCall(request).enqueue(new Callback() {
                @Override
                public void onFailure(Call call, IOException e) {
                    isRefreshing = false;
                    runOnUiThread(() -> {
                        Toast.makeText(QuickAddActivity.this, "Token refresh failed. Open app.", Toast.LENGTH_LONG).show();
                        sendBtn.setEnabled(true);
                    });
                }

                @Override
                public void onResponse(Call call, Response response) throws IOException {
                    isRefreshing = false;
                    if (response.isSuccessful() && response.body() != null) {
                        try {
                            String responseBody = response.body().string();
                            JSONObject jsonResponse = new JSONObject(responseBody);
                            String newAccessToken = jsonResponse.getString("access_token");
                            String newRefreshToken = jsonResponse.optString("refresh_token", refreshToken);

                            // Save new tokens
                            accessToken = newAccessToken;
                            refreshToken = newRefreshToken;
                            
                            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                            prefs.edit()
                                .putString("access_token", newAccessToken)
                                .putString("refresh_token", newRefreshToken)
                                .apply();

                            Log.d(TAG, "Token refreshed successfully");
                            
                            // Retry the original request
                            runOnUiThread(onSuccess::run);
                            
                        } catch (Exception e) {
                            Log.e(TAG, "Error parsing refresh response", e);
                            runOnUiThread(() -> {
                                Toast.makeText(QuickAddActivity.this, "Token error. Open app.", Toast.LENGTH_LONG).show();
                                sendBtn.setEnabled(true);
                            });
                        }
                    } else {
                        Log.e(TAG, "Token refresh failed: " + response.code());
                        runOnUiThread(() -> {
                            Toast.makeText(QuickAddActivity.this, "Session expired. Open app.", Toast.LENGTH_LONG).show();
                            sendBtn.setEnabled(true);
                        });
                    }
                }
            });
        } catch (Exception e) {
            isRefreshing = false;
            Log.e(TAG, "Error creating refresh request", e);
            runOnUiThread(() -> sendBtn.setEnabled(true));
        }
    }
}
