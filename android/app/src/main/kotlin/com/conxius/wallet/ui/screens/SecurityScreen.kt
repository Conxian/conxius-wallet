package com.conxius.wallet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.conxius.wallet.BiometricHelper
import com.conxius.wallet.viewmodel.WalletViewModel

@Composable
fun SecurityScreen(viewModel: WalletViewModel, onUnlockSuccess: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    val error by viewModel.error.collectAsState()
    val isLocked by viewModel.isLocked.collectAsState()
    val integrityResultSecure by viewModel.integrityResultSecure.collectAsState()
    val context = LocalContext.current
    val biometricHelper = remember { BiometricHelper(context as FragmentActivity) }

    LaunchedEffect(isLocked) {
        if (!isLocked) {
            onUnlockSuccess()
        }
    }

    LaunchedEffect(Unit) {
        viewModel.checkIntegrity()
        if (biometricHelper.canAuthenticate()) {
            biometricHelper.showBiometricPrompt(
                "Unlock Wallet",
                "Authenticate to access your enclave",
                onSuccess = {
                    viewModel.unlockWithBiometrics()
                },
                onError = { _, _ -> }
            )
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (integrityResultSecure == false) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier.padding(bottom = 24.dp)
            ) {
                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Warning, contentDescription = "Security Alert", tint = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.width(16.dp))
                    Text(
                        "SECURITY ALERT: Your device integrity is compromised. Enclave access is restricted.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        Icon(
            imageVector = Icons.Default.Lock,
            contentDescription = "Lock",
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Secure Enclave",
            style = MaterialTheme.typography.headlineSmall
        )

        Spacer(modifier = Modifier.height(16.dp))

        TextField(
            value = pin,
            onValueChange = { if (it.length <= 6) pin = it },
            label = { Text("Enter PIN") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = { viewModel.unlock(pin) },
            modifier = Modifier.fillMaxWidth(),
            enabled = pin.length >= 4 && (integrityResultSecure != false)
        ) {
            Text("Unlock with PIN")
        }

        if (biometricHelper.canAuthenticate()) {
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = {
                    biometricHelper.showBiometricPrompt(
                        "Unlock Wallet",
                        "Authenticate to access your enclave",
                        onSuccess = { viewModel.unlockWithBiometrics() },
                        onError = { _, _ -> }
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = integrityResultSecure != false
            ) {
                Icon(Icons.Default.Face, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Unlock with Biometrics")
            }
        }

        error?.let {
            Spacer(modifier = Modifier.height(16.dp))
            Text(text = it, color = MaterialTheme.colorScheme.error)
        }
    }
}
