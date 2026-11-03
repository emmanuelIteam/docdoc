## ADDED Requirements

### Requirement: Release only on a version tag

The repository SHALL provide a GitHub Actions release pipeline that runs only when a git tag is pushed. The tag name SHALL be reused verbatim as the Docker image tag and as the release identifier: no prefix is added, no suffix is derived from the commit, and no other event (branch push, pull request, schedule, manual dispatch) SHALL trigger a release.

#### Scenario: Pushing a tag starts a release

- **WHEN** a tag such as `1.10` is pushed to the repository
- **THEN** the release pipeline starts, builds the image, publishes it, and deploys it

#### Scenario: A branch push starts nothing

- **WHEN** a commit is pushed to `main` without a tag
- **THEN** no release pipeline run is created and no image is published

#### Scenario: The image tag is the git tag

- **WHEN** the pipeline publishes the image for the tag `1.10`
- **THEN** the published reference is `docker.io/emmanuel7044/docdoc:1.10` and the image carries no additional tag

### Requirement: Reject a tag that is not a release version

Before building anything, the pipeline SHALL validate the pushed tag against `^[0-9]+\.[0-9]+(\.[0-9]+)?$`. A tag that does not match SHALL stop the run with a message stating the accepted format, and SHALL NOT publish an image or touch the Scaleway container.

#### Scenario: An invalid tag stops the release

- **WHEN** a tag `v1.2` or `test` is pushed
- **THEN** the run fails at validation, and no image is pushed to Docker Hub and no deployment is attempted

#### Scenario: A three-part version is accepted

- **WHEN** a tag `1.2.3` is pushed
- **THEN** validation passes and the release proceeds with the image tag `1.2.3`

### Requirement: Publish the image under the release tag

The pipeline SHALL authenticate to Docker Hub with a username and an access token read from repository secrets, build the image for `linux/amd64`, push it to `docker.io/emmanuel7044/docdoc:<tag>`, and SHALL NOT publish a `latest` tag. A failed authentication, build, or push SHALL fail the run with a message identifying the failed step.

#### Scenario: A successful publication

- **WHEN** the release for tag `1.10` completes its build
- **THEN** `docker.io/emmanuel7044/docdoc:1.10` is present on Docker Hub, is `linux/amd64`, and no `latest` tag is created or moved

#### Scenario: Invalid credentials fail the run before deployment

- **WHEN** the Docker Hub token is missing or rejected
- **THEN** the run fails at publication and the Scaleway container is left unchanged

### Requirement: Deploy the published image to the Scaleway container

After a successful publication, the pipeline SHALL update the Serverless Container `docdoc-app` (namespace `docdoc-namespace`) to the published image reference using the Scaleway API with credentials read from repository secrets, then wait until the container reports `ready` with that exact image. The wait SHALL be bounded (10 minutes); a timeout, an error status, or a mismatched image reference SHALL fail the run.

#### Scenario: The container is switched to the new image

- **WHEN** the publication succeeded for tag `1.10`
- **THEN** the container's image becomes `docker.io/emmanuel7044/docdoc:1.10`, its status reaches `ready`, and the run succeeds

#### Scenario: A container that never becomes ready fails the run

- **WHEN** the container stays in a non-`ready` status for 10 minutes after the update
- **THEN** the run fails and reports the last observed status

#### Scenario: Deployment is skipped when publication failed

- **WHEN** the build or push step failed
- **THEN** the deployment step does not run and the container keeps its current image

### Requirement: Verify the served release

When the repository defines the `APP_URL` variable, the pipeline SHALL request `$APP_URL/sw.js` after the container is ready, retrying for a bounded time, and SHALL fail if the served worker does not contain the cache version of the release tag. When `APP_URL` is not defined, the check SHALL be skipped and the run SHALL still succeed.

#### Scenario: The new version is actually served

- **WHEN** the container is ready for tag `1.10` and `APP_URL` is defined
- **THEN** the pipeline reads `/sw.js` and asserts it declares `const CACHE_VERSION = '1.10';`

#### Scenario: A stale version fails the verification

- **WHEN** `/sw.js` still advertises the previous cache version after the retry window
- **THEN** the run fails rather than reporting a successful release

#### Scenario: The check is optional

- **WHEN** `APP_URL` is not defined
- **THEN** the verification step is skipped, the run summary says so, and the run succeeds if the other steps did

### Requirement: Serialise runs for the same tag

The pipeline SHALL serialise runs that target the same tag, and SHALL allow a re-run of a failed release to republish the same image tag and redeploy it.

#### Scenario: Two runs on the same tag do not overlap

- **WHEN** the release for `1.10` is triggered again while the first run is still in progress
- **THEN** the runs are serialised by a concurrency group keyed on the tag, so two deployments never overlap

#### Scenario: A failed deployment can be retried

- **WHEN** the image was published but the Scaleway update failed, and the run is re-executed
- **THEN** the same tag is republished and the deployment is retried without creating a new version

### Requirement: Report what was released

The pipeline SHALL expose, in the run summary, the release tag, the published image reference with its digest, the target container, and the outcome of the served-release verification.

#### Scenario: The summary identifies the release

- **WHEN** a release run completes
- **THEN** its summary shows the tag, `docker.io/emmanuel7044/docdoc:<tag>`, the image digest, the container updated, and whether the served version was verified
