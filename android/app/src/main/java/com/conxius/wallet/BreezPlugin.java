package com.conxius.wallet;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Breez SDK Imports
import breez_sdk.BlockingBreezServices;
import breez_sdk.BreezEvent;
import breez_sdk.Config;
import breez_sdk.ConnectRequest;
import breez_sdk.EnvironmentType;
import breez_sdk.EventListener;
import breez_sdk.GreenlightNodeConfig;
import breez_sdk.NodeConfig;
import breez_sdk.NodeState;
import breez_sdk.Payment;
import breez_sdk.LogEntry;

@CapacitorPlugin(name = "Breez")
public class BreezPlugin extends Plugin {
    private static final String TAG = "BreezPlugin";
    private BlockingBreezServices breezServices;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void start(PluginCall call) {
        String mnemonic = call.getString("mnemonic");
        String apiKey = call.getString("apiKey");
        String inviteCode = call.getString("inviteCode"); // Greenlight invite

        if (mnemonic == null || apiKey == null) {
            call.reject("Missing mnemonic or apiKey");
            return;
        }

        executor.submit(() -> {
            try {
                // Config
                Config config = breez_sdk.BreezSdkMethods.defaultConfig(
                    EnvironmentType.PRODUCTION,
                    apiKey,
                    breez_sdk.BreezSdkMethods.defaultNodeConfig(breez_sdk.NodeConfigVariant.GREENLIGHT, new GreenlightNodeConfig(null, inviteCode))
                );

                // Connect
                ConnectRequest connectRequest = new ConnectRequest(config, breez_sdk.BreezSdkMethods.mnemonicToSeed(mnemonic));
                this.breezServices = breez_sdk.BreezSdkMethods.connect(connectRequest, new EventListener() {
                     @Override
                     public void onEvent(BreezEvent e) {
                         Log.d(TAG, "Breez Event: " + e.toString());
                         // Bridge events to JS?
                         // notifyListeners("breezEvent", new JSObject().put("type", e.toString()));
                     }
                });

                NodeState state = this.breezServices.nodeInfo();
                JSObject ret = new JSObject();
                ret.put("id", state.getId());
                ret.put("balanceMsat", state.getMaxPayableMsat()); 
                call.resolve(ret);

            } catch (Exception e) {
                Log.e(TAG, "Failed to start Breez", e);
                call.reject("Start failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void nodeInfo(PluginCall call) {
        if (breezServices == null) {
            call.reject("Not started");
            return;
        }
        try {
            NodeState state = breezServices.nodeInfo();
            JSObject ret = new JSObject();
            ret.put("id", state.getId());
            ret.put("blockHeight", state.getBlockHeight());
            ret.put("maxPayableMsat", state.getMaxPayableMsat());
            ret.put("maxReceivableMsat", state.getMaxReceivableMsat());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void invoice(PluginCall call) {
        if (breezServices == null) {
            call.reject("Not started");
            return;
        }
        Long amountMsat = call.getLong("amountMsat"); // can be null for any amount
        String description = call.getString("description", "");
        
        executor.submit(() -> {
            try {
                 // receivePayment(amountMsat: Long?, description: String, preimage: List<UByte>? = null, openingFeeParams: OpeningFeeParams? = null, useDescriptionHash: Boolean? = null, expiry: Long? = null, cltv: UInt? = null): ReceivePaymentResponse
                breez_sdk.ReceivePaymentResponse response = breezServices.receivePayment(
                    amountMsat, 
                    description, 
                    new java.util.ArrayList<>(), // preimage (optional)
                    null, // openingFeeParams
                    null, // useDescriptionHash
                    null, // expiry
                    null // cltv
                );
                
                JSObject ret = new JSObject();
                ret.put("bolt11", response.getLnInvoice().getBolt11());
                ret.put("paymentHash", response.getLnInvoice().getPaymentHash());
                call.resolve(ret);
            } catch (Exception e) {
                 call.reject("Invoice failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void pay(PluginCall call) {
        if (breezServices == null) {
            call.reject("Not started");
            return;
        }
        String bolt11 = call.getString("bolt11");
        if (bolt11 == null) {
            call.reject("Missing bolt11");
            return;
        }

        executor.submit(() -> {
            try {
                breez_sdk.Payment result = breezServices.sendPayment(bolt11, null);
                JSObject ret = new JSObject();
                ret.put("paymentHash", result.getId());
                ret.put("status", result.getStatus().name());
                ret.put("amountMsat", result.getAmountMsat());
                call.resolve(ret);
            } catch (Exception e) {
                 call.reject("Pay failed: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void lnurlAuth(PluginCall call) {
        if (breezServices == null) {
            call.reject("Not started");
            return;
        }
        String lnurl = call.getString("lnurl");
        if (lnurl == null) {
            call.reject("Missing lnurl");
            return;
        }

        executor.submit(() -> {
            try {
                breez_sdk.InputType input = breez_sdk.BreezSdkMethods.parseInput(lnurl);
                if (input instanceof breez_sdk.InputType.LnUrlAuth) {
                    breez_sdk.LnUrlAuthRequestData data = ((breez_sdk.InputType.LnUrlAuth) input).getData();
                    breez_sdk.LnUrlCallbackStatus result = breezServices.lnurlAuth(data);
                    
                    if (result instanceof breez_sdk.LnUrlCallbackStatus.Ok) {
                         call.resolve();
                    } else {
                         // Extract error details if available in the variant
                         call.reject("LNURL Auth failed with status: " + result.toString());
                    }
                } else {
                    call.reject("Provided string is not a valid LNURL-Auth URL");
                }
            } catch (Exception e) {
                call.reject("LNURL Auth Error: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (breezServices != null) {
             try {
                breezServices.disconnect();
             } catch (Exception e) {} // ignore
             breezServices = null;
        }
        call.resolve();
    }
}
