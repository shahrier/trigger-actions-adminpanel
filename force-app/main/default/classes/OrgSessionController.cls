public with sharing class OrgSessionController {
  @TestVisible
  private static String mockSessionId;

  /**
   * @description Fetches the API-enabled session ID by loading the SessionIdPage Visualforce page.
   * @return String The current session ID, or empty string if an error occurs.
   */
  // NOT cacheable: the session ID rotates/expires, and a cached value would be
  // served stale by the Lightning client cache, causing intermittent 401s on
  // the direct API callouts that consume it (resolvable only by a hard reload).
  @AuraEnabled(cacheable=false)
  public static String getSessionId() {
    if (mockSessionId != null) {
      return mockSessionId;
    }
    try {
      PageReference sessionPage = Page.SessionIdPage;
      return sessionPage.getContent().toString().trim();
    } catch (Exception e) {
      return '';
    }
  }

  /**
   * @description Fetches the base instance URL for the org.
   * @return String The base URL.
   */
  @AuraEnabled(cacheable=true)
  public static String getOrgDomainUrl() {
    return Url.getOrgDomainUrl().toExternalForm();
  }
}
