package com.conxius.wallet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

@CapacitorPlugin(name = "Ldk")
public class LdkPlugin extends Plugin {
  @PluginMethod
  public void getStatus(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("configured", false);
    ret.put("balance", 0);
    ret.put("maxAllowToPay", 0);
    ret.put("maxAllowToReceive", 0);
    ret.put("onChainBalance", 0);
    call.resolve(ret);
  }

  @PluginMethod
  public void createInvoice(PluginCall call) {
    call.reject("LDK not configured");
  }

  @PluginMethod
  public void payInvoice(PluginCall call) {
    call.reject("LDK not configured");
  }

  @PluginMethod
  public void lnurlPay(PluginCall call) {
    call.reject("LDK not configured");
  }

  @PluginMethod
  public void lnurlWithdraw(PluginCall call) {
    call.reject("LDK not configured");
  }
}

