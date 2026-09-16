const authoring = new URLSearchParams(location.search).has('admin')

if (authoring && import.meta.env.DEV) {
  void import('./admin/portal').then(module => module.initializePortal())
} else {
  void import('./main')
}