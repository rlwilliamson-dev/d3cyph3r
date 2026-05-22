// Cloud track levels.
//
// See levels/linux.js for the full schema documentation. Cloud-specific
// fields used by js/commands/cloud.js (the fake `aws` CLI surface):
//
//   cloud: {
//     s3: {
//       bucketCreatedDate: "2024-08-12 09:14:22",   // optional, formatting only
//       buckets: {
//         "<bucket-name>": {
//           "key/path": { content: "...", size: 1234, date: "2024-08-12 09:14:22" },
//           ...
//         },
//         ...
//       },
//     },
//     iam: {
//       users: [
//         { user_name: "service-account", arn: "arn:aws:iam::1234:user/service-account" },
//         ...
//       ],
//       attachedUserPolicies: {
//         "service-account": [
//           { PolicyName: "AdministratorAccess", PolicyArn: "arn:aws:iam::aws:policy/AdministratorAccess" },
//           ...
//         ],
//       },
//       policies: {
//         "arn:aws:iam::aws:policy/AdministratorAccess": {
//           PolicyName: "AdministratorAccess",
//           Description: "Provides full access to AWS services and resources.",
//           DefaultVersionId: "v1",
//           Document: { Version: "2012-10-17", Statement: [...] },
//         },
//       },
//     },
//     ec2: {
//       instances: [
//         {
//           InstanceId: "i-0abc123",
//           InstanceType: "t3.medium",
//           State: "running",
//           PublicIp: "54.x.x.x",
//           PrivateIp: "10.0.0.x",
//           SecurityGroups: ["sg-0abc"],
//           IamInstanceProfile: "arn:aws:iam::1234:instance-profile/web-tier",
//           Tags: { Name: "web-01", Env: "prod" },
//         },
//         ...
//       ],
//       securityGroups: [
//         {
//           GroupId: "sg-0abc",
//           GroupName: "web-tier-sg",
//           Description: "Web tier ingress",
//           IngressRules: [
//             { protocol: "tcp", fromPort: 443, toPort: 443, sources: ["0.0.0.0/0"] },
//             { protocol: "tcp", fromPort: 22,  toPort: 22,  sources: ["0.0.0.0/0"] },  // bad
//           ],
//         },
//         ...
//       ],
//     },
//     sts: {
//       UserId: "AIDAEXAMPLEUSERID",
//       Account: "123456789012",
//       Arn:     "arn:aws:iam::123456789012:user/service-account",
//     },
//   }
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm. Each track introduces a new client engagement to
// diversify the post-mortems' compliance contexts.

export const cloudLevels = {

  // No levels yet. The Cloud engine surface ships in v0.4; the first
  // level0@cloud will land in a follow-up PR.

};
