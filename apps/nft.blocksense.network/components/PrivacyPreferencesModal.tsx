'use client';
import { useState, useEffect } from 'react';
import { useConsent } from '../hooks/use-consent';
import { Button } from '../radixUiComponents/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../radixUiComponents/dialog';
import { Switch } from '../radixUiComponents/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../radixUiComponents/card';
import { Settings, Shield, BarChart3, Megaphone, Info } from 'lucide-react';

export const PrivacyPreferencesModal = () => {
  const {
    preferencesModalVisible,
    hidePreferencesModal,
    preferences,
    savePreferences,
  } = useConsent();

  const [analytics, setAnalytics] = useState(preferences.analytics);
  const [marketing, setMarketing] = useState(preferences.marketing);

  useEffect(() => {
    setAnalytics(preferences.analytics);
    setMarketing(preferences.marketing);
  }, [preferences]);

  const handleSave = () => {
    savePreferences({ analytics, marketing });
  };

  const handleCancel = () => {
    setAnalytics(preferences.analytics);
    setMarketing(preferences.marketing);
    hidePreferencesModal();
  };

  return (
    <Dialog open={preferencesModalVisible} onOpenChange={hidePreferencesModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Settings className="mr-2 h-5 w-5 text-primary" />
            Privacy Preferences
          </DialogTitle>
          <DialogDescription>
            Manage your cookie preferences and control how we collect and use
            your data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Essential Cookies */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-md">
                <Shield className="mr-2 h-4 w-4 text-success" />
                Essential Cookies
              </CardTitle>
              <CardDescription>
                Required for basic site functionality. Cannot be disabled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Always active
                </span>
                <Switch checked={true} disabled className="opacity-50" />
              </div>
            </CardContent>
          </Card>

          {/* Analytics Cookies */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-md">
                <BarChart3 className="mr-2 h-4 w-4 text-primary" />
                Analytics Cookies
              </CardTitle>
              <CardDescription>
                Help us understand how visitors interact with our website.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Enable analytics tracking
                  </span>
                  <Switch checked={analytics} onCheckedChange={setAnalytics} />
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                  <div>
                    <strong>Data collected:</strong> Page views, user
                    interactions, performance metrics
                  </div>
                  <div>
                    <strong>Third parties:</strong> Google Analytics 4
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Marketing Cookies */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-md">
                <Megaphone className="mr-2 h-4 w-4 text-warning" />
                Marketing Cookies
              </CardTitle>
              <CardDescription>
                Used to deliver targeted advertisements and measure campaign
                effectiveness.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Enable marketing tracking
                  </span>
                  <Switch checked={marketing} onCheckedChange={setMarketing} />
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                  <div>
                    <strong>Data collected:</strong> Ad interactions, conversion
                    tracking, audience insights
                  </div>
                  <div>
                    <strong>Third parties:</strong> Google Ads, Facebook Pixel
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Rights Information */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex">
                <Info className="h-4 w-4 text-primary mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-primary mb-2">
                    Your Privacy Rights
                  </h4>
                  <ul className="text-sm text-primary/80 space-y-1">
                    <li>• You can change these preferences at any time</li>
                    <li>• Withdrawing consent may limit some features</li>
                    <li>• We comply with GDPR and other privacy regulations</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          <Button onClick={handleSave} className="flex-1">
            Save Preferences
          </Button>
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
