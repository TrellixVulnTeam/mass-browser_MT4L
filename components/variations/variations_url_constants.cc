// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "components/variations/variations_url_constants.h"

namespace variations {

// Default server of Variations seed info.
#if defined(OS_ANDROID)
const char kDefaultServerUrl[] =
    "https://clientservices.googleapis.com/chrome-variations/seed";
#else
const char kDefaultServerUrl[] =
    "https://clients4.google.com/chrome-variations/seed";
#endif

}  // namespace variations