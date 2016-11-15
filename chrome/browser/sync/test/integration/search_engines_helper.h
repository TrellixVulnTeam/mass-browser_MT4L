// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_SYNC_TEST_INTEGRATION_SEARCH_ENGINES_HELPER_H_
#define CHROME_BROWSER_SYNC_TEST_INTEGRATION_SEARCH_ENGINES_HELPER_H_

#include <map>
#include <memory>
#include <string>

#include "base/strings/string16.h"
#include "chrome/browser/sync/test/integration/await_match_status_change_checker.h"

class Profile;
class TemplateURL;
class TemplateURLService;

typedef std::map<std::string, const TemplateURL*> GUIDToTURLMap;

namespace search_engines_helper {

// Used to access the search engines within a particular sync profile.
TemplateURLService* GetServiceForBrowserContext(int profile_index);

// Used to access the search engines within the verifier sync profile.
TemplateURLService* GetVerifierService();

// Compared a single TemplateURLService for a given profile to the verifier.
// Retrns true iff their user-visible fields match.
bool ServiceMatchesVerifier(int profile_index);

// Returns true iff all TemplateURLServices match with the verifier.
bool AllServicesMatch();

// Create a TemplateURL with some test values based on |seed|.
std::unique_ptr<TemplateURL> CreateTestTemplateURL(
    Profile* profile,
    int seed,
    const base::string16& keyword,
    const std::string& sync_guid);
std::unique_ptr<TemplateURL> CreateTestTemplateURL(
    Profile* profile,
    int seed,
    const base::string16& keyword,
    const std::string& url,
    const std::string& sync_guid);

// Add a search engine based on a seed to the service at index |profile_index|
// and the verifier if it is used.
void AddSearchEngine(int profile_index, int seed);

// Retrieves a search engine from the service at index |profile_index| with
// original keyword |keyword| and changes its user-visible fields. Does the same
// to the verifier, if it is used.
void EditSearchEngine(int profile_index,
                      const base::string16& keyword,
                      const base::string16& short_name,
                      const base::string16& new_keyword,
                      const std::string& url);

// Deletes a search engine from the service at index |profile_index| which was
// generated by seed |seed|.
void DeleteSearchEngineBySeed(int profile_index, int seed);

// Change the search engine generated with |seed| in service at index
// |profile_index| to be the new default. Does the same to the verifier, if it
// is used.
void ChangeDefaultSearchProvider(int profile_index, int seed);

// Returns true if the profile at |profile_index| has a search engine matching
// the search engine generated with |seed|.
bool HasSearchEngine(int profile_index, int seed);

}  // namespace search_engines_helper

// Checker that blocks until all services have the same search engine data.
class SearchEnginesMatchChecker : public AwaitMatchStatusChangeChecker {
 public:
  SearchEnginesMatchChecker();
};

#endif  // CHROME_BROWSER_SYNC_TEST_INTEGRATION_SEARCH_ENGINES_HELPER_H_