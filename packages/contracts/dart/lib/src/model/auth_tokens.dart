//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'auth_tokens.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AuthTokens {
  /// Returns a new [AuthTokens] instance.
  AuthTokens({

    required  this.tokenType,

    required  this.accessToken,

    required  this.accessTokenExpiresAt,

    required  this.refreshToken,
  });

  @JsonKey(
    
    name: r'tokenType',
    required: true,
    includeIfNull: false,
  unknownEnumValue: AuthTokensTokenTypeEnum.unknownDefaultOpenApi,
  )


  final AuthTokensTokenTypeEnum tokenType;



  @JsonKey(
    
    name: r'accessToken',
    required: true,
    includeIfNull: false,
  )


  final String accessToken;



  @JsonKey(
    
    name: r'accessTokenExpiresAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime accessTokenExpiresAt;



  @JsonKey(
    
    name: r'refreshToken',
    required: true,
    includeIfNull: false,
  )


  final String refreshToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is AuthTokens &&
      other.tokenType == tokenType &&
      other.accessToken == accessToken &&
      other.accessTokenExpiresAt == accessTokenExpiresAt &&
      other.refreshToken == refreshToken;

    @override
    int get hashCode =>
        tokenType.hashCode +
        accessToken.hashCode +
        accessTokenExpiresAt.hashCode +
        refreshToken.hashCode;

  factory AuthTokens.fromJson(Map<String, dynamic> json) => _$AuthTokensFromJson(json);

  Map<String, dynamic> toJson() => _$AuthTokensToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum AuthTokensTokenTypeEnum {
@JsonValue(r'Bearer')
bearer(r'Bearer'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const AuthTokensTokenTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


