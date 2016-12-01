// Copyright 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef EXTENSIONS_RENDERER_JS_EXTENSION_BINDINGS_SYSTEM_H_
#define EXTENSIONS_RENDERER_JS_EXTENSION_BINDINGS_SYSTEM_H_

#include <memory>
#include <string>

#include "base/macros.h"
#include "extensions/renderer/extension_bindings_system.h"

namespace extensions {
class RequestSender;
class ResourceBundleSourceMap;

// The bindings system using the traditional JS-injection style bindings.
class JsExtensionBindingsSystem : public ExtensionBindingsSystem {
 public:
  JsExtensionBindingsSystem(ResourceBundleSourceMap* source_map,
                            std::unique_ptr<RequestSender> request_sender);
  ~JsExtensionBindingsSystem() override;

  // ExtensionBindingsSystem:
  void DidCreateScriptContext(ScriptContext* context) override;
  void WillReleaseScriptContext(ScriptContext* context) override;
  void UpdateBindingsForContext(ScriptContext* context) override;
  void DispatchEventInContext(const std::string& event_name,
                              const base::ListValue* event_args,
                              const base::DictionaryValue* filtering_info,
                              ScriptContext* context) override;
  void HandleResponse(int request_id,
                      bool success,
                      const base::ListValue& response,
                      const std::string& error) override;
  RequestSender* GetRequestSender() override;

 private:
  void RegisterBinding(const std::string& api_name, ScriptContext* context);

  ResourceBundleSourceMap* source_map_ = nullptr;

  std::unique_ptr<RequestSender> request_sender_;

  DISALLOW_COPY_AND_ASSIGN(JsExtensionBindingsSystem);
};

}  // namespace extensions

#endif  // EXTENSIONS_RENDERER_JS_EXTENSION_BINDINGS_SYSTEM_H_